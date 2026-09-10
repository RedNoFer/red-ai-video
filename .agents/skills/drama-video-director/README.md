# VOZEB PRO 短剧视频导演 Skill

这是项目内的导演方法源文件，服务于制作包、静态关键帧、视频提示词和外部 Codex 的显式导演审阅。

运行时不会直接读取本目录。`web/scripts/compile-drama-video-director-skill.mjs` 会在开发、测试、类型检查和生产构建前将它编译为 TypeScript 模块；业务代码只读取生成模块。

这套 Skill 不提交供应商请求，不改变 13 章制作包协议，不替代 Seedance 的供应商能力与项目连续性策略。
