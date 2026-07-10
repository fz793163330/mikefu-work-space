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

## 钉钉推送

GitHub Actions 已支持把每日摘要推送到钉钉机器人。请在 GitHub 仓库中配置 Secret：

1. 打开仓库 `Settings` → `Secrets and variables` → `Actions`
2. 点击 `New repository secret`
3. Name 填：`DINGTALK_WEBHOOK`
4. Secret 填：你的钉钉机器人 webhook URL
5. 保存后，可进入 `Actions` → `SEO/AEO Daily Digest` → `Run workflow` 手动测试

为了安全，不要把 webhook 明文提交到代码仓库。

钉钉推送当前使用 `text` 消息类型，以兼容不支持 Markdown 消息的机器人类型。消息正文包含 `SEO/AEO` 关键词，若机器人配置了关键词安全校验，请确保关键词包含 `SEO`、`AEO` 或 `SEO/AEO`。
