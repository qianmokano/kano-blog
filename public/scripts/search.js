(() => {
	const pageSize = 12;
	let pagefind;
	let loading;
	let loadAttempt = 0;

	const loadPagefind = () => {
		if (pagefind) return Promise.resolve(pagefind);
		if (!loading) {
			// Failed imports can be cached by the browser as well as this loader.
			const path = '/pagefind/pagefind.js' + (loadAttempt ? '?retry=' + loadAttempt : '');
			loadAttempt += 1;
			loading = import(path)
				.then((module) => {
					pagefind = module;
					return module;
				})
				.catch((error) => {
					loading = undefined;
					throw error;
				});
		}
		return loading;
	};

	const renderResult = (result) => {
		const link = document.createElement('a');
		const url = new URL(result.url, location.origin);
		if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return null;
		link.className = 'search-result';
		link.href = url.href;
		const type = document.createElement('span');
		type.className = 'search-result-type';
		type.textContent = result.meta?.type || '内容';
		const title = document.createElement('strong');
		title.textContent = result.meta?.title || result.url;
		const excerpt = document.createElement('p');
		// Keep Pagefind highlights, but do not insert arbitrary excerpt markup.
		const template = document.createElement('template');
		template.innerHTML = result.excerpt || '';
		const appendText = (source, target) => {
			for (const child of source.childNodes) {
				if (child.nodeName === 'MARK') {
					const mark = document.createElement('mark');
					mark.textContent = child.textContent;
					target.append(mark);
				} else if (child.nodeType === Node.TEXT_NODE) {
					target.append(document.createTextNode(child.textContent || ''));
				} else {
					appendText(child, target);
				}
			}
		};
		appendText(template.content, excerpt);
		link.append(type, title, excerpt);
		return link;
	};

	const connect = (input) => {
		if (input.dataset.searchReady === 'true') return;
		input.dataset.searchReady = 'true';
		const root = input.closest('[data-search-root], [data-search-dialog]');
		const status = root?.querySelector('[data-pagefind-status]');
		const results = root?.querySelector('[data-pagefind-results]');
		const more = root?.querySelector('[data-search-more]');
		const retry = root?.querySelector('[data-search-retry]');
		const reload = root?.querySelector('[data-search-reload]');
		const fullSearch = root?.querySelector('[data-search-all]');
		if (!status || !results || !more || !retry || !reload) return;
		const isPage = root.hasAttribute('data-search-root');
		let requestId = 0;
		let timer;
		let composing = false;
		let matches = [];
		let shown = 0;
		let busy = false;
		let retryAction;
		let query = '';
		let instance;

		const recover = async (id, limit, focusNew) => {
			setBusy(true);
			const failed = instance;
			instance = undefined;
			await failed?.destroy?.();
			if (id === requestId) await search(id, undefined, limit, focusNew);
		};

		const searchUrl = () => '/search/' + (query ? '?q=' + encodeURIComponent(query) : '');
		const savePosition = () => {
			if (!isPage) return;
			const focused = document.activeElement?.closest('.search-result');
			try {
				history.replaceState(
					{
						...history.state,
						kanoSearch: {
							query,
							limit: shown || pageSize,
							scrollY: window.scrollY,
							focusHref: focused?.getAttribute('href'),
						},
					},
					'',
					searchUrl(),
				);
			} catch {
				// Search also works when browser history is unavailable.
			}
		};

		const setBusy = (value) => {
			busy = value;
			more.disabled = value;
			retry.disabled = value;
			results.setAttribute('aria-busy', String(value));
		};
		const fail = (action) => {
			status.textContent = shown
				? '更多结果加载失败，已显示的结果仍可使用。'
				: '搜索暂时不可用，请重试；仍无法恢复时可刷新搜索页。';
			retryAction = action;
			retry.hidden = false;
			reload.hidden = false;
			reload.href = searchUrl();
			more.hidden = true;
		};

		const loadBatch = async (id, limit = shown + pageSize, focusNew = false) => {
			setBusy(true);
			retry.hidden = true;
			reload.hidden = true;
			status.textContent = '正在加载结果…';
			const start = shown;
			try {
				const batch = matches.slice(start, limit);
				const data = await Promise.all(batch.map((item) => item.data()));
				if (id !== requestId) return;
				const links = data.map(renderResult).filter(Boolean);
				results.append(...links);
				shown += batch.length;
				status.textContent = matches.length
					? '已显示 ' + shown + ' / 共 ' + matches.length + ' 条结果'
					: '没有找到相关内容';
				more.hidden = shown >= matches.length;
				// Pagefind can return no matches after swallowing an index download failure.
				// Allow a fresh instance even when that failure is indistinguishable from no hits.
				if (!matches.length) {
					retryAction = () => recover(id, limit, focusNew);
					retry.hidden = false;
				}
				if (focusNew) links[0]?.focus({ preventScroll: true });
				savePosition();
			} catch {
				if (id === requestId) fail(() => recover(id, limit, focusNew));
			} finally {
				if (id === requestId) setBusy(false);
			}
		};

		const search = async (id, saved, retryLimit, focusNew = false) => {
			if (id !== requestId || !query) return;
			setBusy(true);
			status.textContent = '正在搜索…';
			try {
				const module = await loadPagefind();
				if (id !== requestId) return;
				instance ??= module.createInstance ? module.createInstance({ excerptLength: 28 }) : module;
				const response = await instance.search(query);
				if (id !== requestId) return;
				matches = response.results;
				const limit =
					saved?.query === query && Number.isSafeInteger(saved.limit)
						? Math.max(pageSize, Math.min(saved.limit, matches.length))
						: pageSize;
				await loadBatch(id, retryLimit ?? limit, focusNew);
				if (id !== requestId || !retry.hidden || saved?.query !== query) return;
				requestAnimationFrame(() => {
					if (id !== requestId) return;
					const link = [...results.querySelectorAll('a')].find(
						(item) => item.getAttribute('href') === saved.focusHref,
					);
					link?.focus({ preventScroll: true });
					if (Number.isFinite(saved.scrollY)) {
						window.scrollTo({ top: saved.scrollY, behavior: 'instant' });
					}
				});
			} catch {
				if (id === requestId) {
					setBusy(false);
					fail(() => recover(id, retryLimit, focusNew));
				}
			}
		};

		const update = (immediate = false, saved) => {
			clearTimeout(timer);
			const id = ++requestId;
			query = input.value.trim();
			matches = [];
			shown = 0;
			setBusy(false);
			results.replaceChildren();
			results.scrollTop = 0;
			more.hidden = retry.hidden = reload.hidden = true;
			status.textContent = '';
			if (fullSearch) fullSearch.href = searchUrl();
			if (!saved) savePosition();
			if (!query || composing) return;
			if (immediate) void search(id, saved);
			else timer = setTimeout(() => void search(id), 180);
		};

		input.addEventListener('compositionstart', () => {
			composing = true;
			clearTimeout(timer);
			++requestId;
		});
		input.addEventListener('compositionend', () => {
			composing = false;
			update();
		});
		input.addEventListener('input', () => update());
		more.addEventListener('click', () => {
			if (!busy) void loadBatch(requestId, shown + pageSize, true);
		});
		retry.addEventListener('click', () => {
			if (!busy) {
				retry.hidden = reload.hidden = true;
				void retryAction?.();
			}
		});
		if (isPage) {
			const restore = () => {
				input.value = new URLSearchParams(location.search).get('q') || '';
				update(true, history.state?.kanoSearch);
			};
			window.addEventListener('pagehide', savePosition);
			results.addEventListener('click', savePosition);
			window.addEventListener('popstate', restore);
			restore();
		}
	};

	document.querySelectorAll('[data-pagefind-input]').forEach(connect);
})();
