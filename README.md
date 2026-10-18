# blog

极简静态博客：`build.mjs` 构建 + htmx 局部刷新 + hugo-book 样式，部署于 GitHub Pages。

## 命令

```bash
npm install        # 首次安装依赖
npm run build      # 编译：content/ → public/（约 200ms）
npm run serve      # 预览：构建后启动本地服务
```

预览地址：<http://localhost:4321/blog/zh/>（换端口：`npm run serve -- 8080`）

本地与生产同为 `/blog` 前缀，路径行为一致。

## 写文章

`content/<语言>/` 下新建 `.md`，frontmatter 支持：

```yaml
---
title: 标题
date: 2026-10-18
description: RSS 摘要（缺省取正文前 200 字）
draft: true   # 跳过构建
---
```

- 路径即 URL：`content/zh/posts/foo.md` → `/blog/zh/posts/foo/`
- `index.md` 为所在目录首页
- 某语言缺该页时自动生成"暂未翻译"占位页，语言切换不会 404
- 公式 `$...$` / `$$...$$`（构建期 MathJax→SVG）、代码 Shiki 双主题高亮、原文 `<details>` 直通

## 结构

```
content/<lang>/**.md       源内容（zh / en），主要编辑这里
src/
├── build/                 构建脚本
│   ├── index.mjs          编排入口（--serve 分支）
│   ├── config.mjs         BASE/SITE_URL/路径/UI 文案
│   ├── content.mjs        扫描 md + 并集树
│   ├── markdown.mjs       markdown-it / TOC / 公式 / Shiki
│   ├── page.mjs           树 HTML + 模板替换 + 占位页
│   ├── rss.mjs            RSS 2.0 生成
│   └── serve.mjs          本地 HTTP 服务
├── template.html          页面骨架（{{TOKEN}} 占位）
├── locales/ui.<lang>.json 界面文案
├── styles/*.css           按文件名序拼接 → public/style.css
└── static/                htmx.min.js / app.js（原样拷贝）
public/                    构建产物（gitignore）
.temp/                     过程资料（gitignore）
.github/workflows/deploy.yml  push master 自动部署
```

## 部署

push `master` 后 Actions 自动 `build` 并发布；仓库 Settings → Pages → Source 选 **GitHub Actions**。

RSS：`/blog/zh/rss.xml`、`/blog/en/rss.xml`（RSS 2.0，含 atom:self）。
