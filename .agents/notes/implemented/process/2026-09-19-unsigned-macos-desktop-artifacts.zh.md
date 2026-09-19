# Agent Note: Build unsigned macOS Desktop artifacts for local use

Status: implemented

[English](2026-09-19-unsigned-macos-desktop-artifacts.md) | 中文

## Problem

发布流程要求每条 macOS 打包命令都提供 Developer ID 身份和一套完整公证凭据，仅生成目录和仅准备的命令也不例外。没有 Apple 凭据的开发者因此无法生成可运行的 macOS 应用，而 Windows 早已提供显式的 `--unsigned` 模式用于本地安装测试。

## Decision

`--unsigned` 除 `win-x64` 外也接受 macOS 目标，并选择本地产物路径：`prepare:dsh` 保留打包 Mach-O 文件的厂商签名，electron-builder 使用 `identity: null`、`forceCodeSigning: false`、`notarize: false` 且不签名 DMG，临时签名钥匙串不会创建，构建环境会删除 `CSC_*`、`APPLE_*` 和 `DSH_DESKTOP_MACOS_*` 值，使已配置或可发现的身份都无法签名。产物写入发布产物旁边的 `unsigned-artifacts/`，不包含更新配置，也不生成发布完成记录。

只有显式传入 `--unsigned` 才会进入该路径。[macOS 正式发布打包](../architecture/2026-08-25-electron-desktop-packaging-and-updates.zh.md)仍要求身份、一套完整公证凭据及其验证，之后才会生成发布产物或完成记录，因此配置错误的发布流程会直接失败，不会产出未签名构建。未签名应用只能在本机构建主机上运行，其他设备上的 Gatekeeper 会拒绝它。

## Alternatives considered

**把 `--dir` 当作无凭据模式。** 仅生成目录的命令用于对已公证应用的发布验收，且运行时准备会在 electron-builder 启动前签名 Mach-O 文件。取消该路径的凭据要求会改变发布操作人员验收的内容，因此本地产物需要自己的显式请求。

**改为对应用做 ad-hoc 签名。** ad-hoc 签名不携带 Developer ID 身份，也没有公证票据，只会增加一条验证规则不同的签名分支，产物在其他设备上仍会被 Gatekeeper 拒绝。

**允许未签名构建省略 `.env.macos`。** 应用 ID 和强更源站会写入包括未签名产物在内的每个应用。保留单一且经过校验的配置来源，可以避免出现第二条更宽松的配置路径。

## Consequences

macOS 构建主机上的开发者无需 Apple 凭据即可生成可运行的应用，两个桌面平台也共用同一套 `--unsigned` 术语。代价是打包脚本中增加一个平台分支，以及一种绝不能离开构建主机的产物：上传会读取 `artifacts/` 中的发布完成记录，而未签名构建从不写入该记录。
