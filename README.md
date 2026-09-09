# Kano Blog

Kano 的个人博客，使用 Astro、TypeScript、MDX、Pagefind 和 Giscus 构建。网站完全静态生成，正式地址为 [blog.kanojyo.de](https://blog.kanojyo.de)。

## 本地开发

需要 Node.js 22.12+ 和 pnpm 10。

```sh
pnpm install
pnpm dev
```

`pnpm dev` 会按照 Astro 工作区约定在后台启动开发服务器。使用以下命令管理它：

```sh
pnpm dev:status
pnpm dev:logs
pnpm dev:stop
```

常用检查命令：

```sh
pnpm check          # Astro 类型检查、ESLint、Prettier
pnpm test           # Vitest 单元测试与覆盖率
pnpm build          # 静态构建并生成 Pagefind 索引
pnpm preview        # 预览已经构建的站点
pnpm test:e2e       # 对已有构建运行 Playwright
pnpm test:e2e:full  # 构建后运行 Playwright
```

开发服务器没有 Pagefind 索引；需要运行生产构建后才能完整验证搜索。

## 内容发布

内容位于 `src/content`：

- `blog/`：长文章，支持 MDX、标签、精选和评论开关。
- `notes/`：短笔记。
- `projects/`：项目详情与技术栈。
- `pages/`：About、Uses、Now 等单页。
- `friends.json`：友链数据；复制隐藏模板并改成新的唯一键即可添加友链。

文章示例：

```mdx
---
title: 文章标题
description: 用于列表与 SEO 的简短摘要
publishedAt: 2026-08-31
updatedAt: 2026-09-01
tags:
  - Astro
featured: false
draft: false
comments: true
---

正文内容。
```

生产构建会排除 `draft: true` 的文章、笔记和项目。图片应优先放在相应内容附近，并通过 MDX 导入，以便 Astro 自动优化；无需处理的静态资源放在 `public/`。

文章和项目可在 frontmatter 中设置 `cover: ./cover.png` 和 `coverAlt: 图片说明`。封面会显示在详情页，并由 Astro 生成 1200×630 PNG 用作分享图；请避免把重要内容放在可能被裁切的边缘。未设置封面时，构建会为每篇文章和项目生成包含标题的独立 PNG，默认分享图为 `/og/default.png`。生成使用随项目保存的 Noto Sans SC 字体，不需要联网。

搜索支持“加载更多”、失败重试和完整搜索页的 `?q=关键词` 链接。返回搜索页或刷新时会恢复当前历史记录中已加载的结果数量与阅读位置。手机文章目录默认折叠，可在阅读过程中打开并跳转章节。

## 评论

Giscus 依赖公开仓库 `qianmokano/kano-blog`：

1. 在 GitHub 仓库设置中启用 Discussions。
2. 安装 [Giscus App](https://github.com/apps/giscus)。
3. 创建或选择 `Announcements` 分类。
4. 通过 [giscus.app/zh-CN](https://giscus.app/zh-CN) 获取仓库与分类 ID。
5. 当前仓库和分类的公开 ID 已设为默认值。迁移仓库或分类时，可复制 `.env.example` 为 `.env` 并覆盖：

```dotenv
PUBLIC_GISCUS_REPO_ID=R_kgDOUJftFw
PUBLIC_GISCUS_CATEGORY_ID=DIC_kwDOUJftF84DEj-1
```

这些 ID 是公开配置，不是访问密钥。

## Cloudflare Pages

将公开 GitHub 仓库连接到 Cloudflare Pages：

- Production branch：`main`
- Build command：`pnpm build`
- Build output directory：`dist`
- Node.js：22

首次部署成功后再绑定 `blog.kanojyo.de`。确认 Cloudflare 提供的目标记录与现有 DNS 用途后再修改 DNS，不要直接覆盖未知记录。最后在 Cloudflare 控制台启用 Web Analytics。

推送和 Pull Request 会通过 GitHub Actions 执行类型检查、格式检查、单元测试、生产构建、Pagefind 搜索和 Playwright 可访问性测试。

## 许可

除原创内容外，本项目源代码采用 [MIT License](LICENSE)。

`src/content/` 中的文章、笔记、项目说明和其他原创内容，以及相关图片与媒体文件，版权归 Kano 所有，除非文件中另有说明，否则不包含在 MIT License 的授权范围内。
