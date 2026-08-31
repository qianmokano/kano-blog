(() => {
	let pagefind;
	let loading;
	const escapeHtml = (value) =>
		value.replace(
			/[&<>'"]/g,
			(character) =>
				({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character],
		);

	const loadPagefind = async () => {
		if (pagefind) return pagefind;
		if (!loading) {
			loading = import('/pagefind/pagefind.js').then(async (module) => {
				await module.options({ excerptLength: 28 });
				pagefind = module;
				return pagefind;
			});
		}
		return loading;
	};

	const renderResult = (result) => {
		const title = escapeHtml(result.meta?.title || result.url);
		const type = escapeHtml(result.meta?.type || '内容');
		return `<a class="search-result" href="${encodeURI(result.url)}">
			<span class="search-result-type">${type}</span>
			<strong>${title}</strong>
			<p>${result.excerpt || ''}</p>
		</a>`;
	};

	const connect = (input) => {
		if (input.dataset.searchReady === 'true') return;
		input.dataset.searchReady = 'true';
		const root = input.closest('[data-search-root]') || input.closest('[data-search-dialog]');
		const status = root?.querySelector('[data-pagefind-status]');
		const results = root?.querySelector('[data-pagefind-results]');
		let requestId = 0;

		input.addEventListener('input', async () => {
			const query = input.value.trim();
			const currentRequest = ++requestId;
			if (!results || !status) return;
			if (!query) {
				status.textContent = '输入关键词开始搜索';
				results.replaceChildren();
				return;
			}

			status.textContent = '正在搜索…';
			try {
				const api = await loadPagefind();
				const search = await api.search(query);
				const data = await Promise.all(search.results.slice(0, 12).map((item) => item.data()));
				if (currentRequest !== requestId) return;
				status.textContent = data.length
					? `找到 ${search.results.length} 条结果`
					: '没有找到相关内容';
				results.innerHTML = data.map(renderResult).join('');
			} catch {
				if (currentRequest !== requestId) return;
				status.textContent =
					location.hostname === 'localhost'
						? '搜索索引将在生产构建后可用'
						: '搜索暂时不可用，请稍后重试';
				results.replaceChildren();
			}
		});
	};

	document.querySelectorAll('[data-pagefind-input]').forEach(connect);
})();
