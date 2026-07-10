# SEO/AEO 自动学习工作区

这个仓库配置了 GitHub Actions 云端定时任务，用于每天检查 SEO 资讯源是否有新文章，并生成 SEO/AEO 方法论沉淀报告。

## 定时任务

- Workflow: `.github/workflows/seo-aeo-digest.yml`
- 运行时间：每天北京时间 09:00（UTC 01:00）
- 也可在 GitHub Actions 页面手动点击 `Run workflow` 触发

## 输出

- 报告目录：`reports/`
- 去重状态：`seo_automation_state.json`

## 本地运行

```powershell
node .\seo_automation.mjs
```

或使用 Windows 包装脚本：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\run_seo_automation.ps1
```

## 注意

Search Engine Land 当前可能对自动抓取返回 Cloudflare/403；脚本会把异常写入报告，不影响 Search Engine Journal 的日报生成。
