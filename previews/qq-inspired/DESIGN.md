---
name: Patrick Luo · 粒子全屏博客预览
description: 深海军蓝空间中的银白粒子雕塑，以四章全屏切换串联思想、文字与作品。
colors:
  background: "#080b17"
  ink: "#f3f4fa"
  muted: "#a2a9bf"
  soft: "#c4c8da"
  line: "#f3f4fa25"
  accent: "#c9c5ff"
typography:
  display:
    fontFamily: 'Space, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "clamp(32px, 3.25vw, 53px)"
    fontWeight: 500
    lineHeight: 1.22
    letterSpacing: "-0.025em"
  body:
    fontFamily: 'Space, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.9
    letterSpacing: "normal"
  label:
    fontFamily: "Space, sans-serif"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "0.24em"
  article-body:
    fontFamily: 'Space, "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 2.2
    letterSpacing: "normal"
rounded:
  circular: "50%"
  code: "3px"
spacing:
  compact: "12px"
  brand-gap: "20px"
  mobile-inset: "24px"
  copy-gap: "35px"
  desktop-inset: "48px"
components:
  icon-button:
    textColor: "#c8ccde"
    rounded: "{rounded.circular}"
    size: "42px"
  icon-button-hover:
    backgroundColor: "#ffffff0d"
    textColor: "#ffffff"
  icon-button-active:
    backgroundColor: "#ffffff12"
    textColor: "{colors.accent}"
  line-link:
    textColor: "{colors.ink}"
    padding: "12px 0 15px"
  article-row:
    textColor: "{colors.ink}"
    padding: "19px 0"
---

# Design System: Patrick Luo · 粒子全屏博客预览

## Overview

**Creative North Star: "思想的粒子宇宙"**

本文件只约束 `qq-inspired` 独立预览。用户已明确选择“尽量贴近原站，整站全屏切换”，参考为 [腾讯 UP 2017 页面](https://up.qq.com/act/a20170301pre/index.html#)。这里将参考中的暗色空间、粒子形体、细小导航和分屏节奏转译为 Patrick Luo 的博客；不是腾讯页面源代码或素材的复制。

界面以银白粒子雕塑为主视觉，英文内容保持克制。首屏与章节索引采用 Experience 模式；文章阅读页采用 Read 模式，使用正常纵向滚动。此方向尚处预览评审阶段，不代表主站设计规范已经变更。

**Key Characteristics:**

- 深海军蓝背景、银白点阵、少量淡紫强调。
- 起点、文字、造物、关于四章，画面一次只展示一章。
- 桌面采用左侧粒子、右侧文案，手机采用上方粒子、下方文案。
- 本地字体、原生 HTML/CSS/JavaScript 与原创几何粒子形体。

## Colors

配色由现有 `styles.css` 中的六个 CSS 自定义属性提取。背景退后，正文与点阵承担亮度，淡紫只用于标点、交互状态和细线。

### Primary

- **淡紫强调色**：标题末尾标点、焦点轮廓、选中筛选线、项目链接与进度标识。

### Neutral

- **深海军蓝**：全站背景与沉浸空间的基底。
- **银白正文**：标题、主要文本与当前章节。
- **柔和浅灰**：简介与次要说明。
- **冷灰标签**：英文副标题、元信息与非当前导航。
- **透明银白分隔线**：文章列表、项目列表与阅读分隔。

**The Quiet Accent Rule.** 强调色只标记当前状态和关键细节，不给整片内容容器着色。

## Typography

拉丁字母使用本地 `assets/space-grotesk.ttf`，以 `Space` 注册；中文依次回退到苹方、微软雅黑与系统无衬线。正文不依赖远程字体请求。

章节标题为中等字重，保持宽松行高与简短断句。英文标签小而疏，作为标题的辅助信息。文章正文使用较长行高，阅读容器最大宽度为 760px，正文不沿用章节舞台的窄列。

手机首页标题为 33px，其余三章为 29px；较宽的堆叠布局使用 34px。阅读页标题在桌面为 `clamp(30px, 4vw, 48px)`，手机为 30px；手机正文为 14px、2.1 行高。

## Layout

主体验占满 `100svh`。前景画布装在独立 `#scene-stage` 内，采用 paint containment 和裁切；渲染器按实际画布尺寸居中缩放，动画碎片不会进入文字区域。桌面展示区域从横向 16% 开始，宽 50%；文案列从 70% 开始。页头、页脚和章节导航保持原有位置。

宽度不超过 1000px 时使用上图下文：图形从 84px 起，占约 30svh；形态名、计数和手动换形按钮放在其下；文案从展示区底部以下 58px 开始，保留页脚空间。600–1000px 且高度不超过 600px 时使用横屏并排构图。较短手机进一步缩小展示区。文字在自己的可聚焦区域内滚动；一段触摸滚动不会在到达内容末端时意外触发翻章。

文章阅读页正常滚动，在内容顶部和末尾提供返回“文字”的入口。全屏切章只适用于四章索引，不强加到文章正文。

### TableSync detail surface

`tablesync.html` extends this preview with an English architecture detail page. It inherits the existing frontmatter tokens, local Space typeface, deep navy background, silver linework, and quiet accent. Its composition is specific to project exploration; it does not replace the four-chapter layout.

Above 900px, the diagram sits beside a bounded reading column. Tabs and the next-layer control remain outside the independently scrolling explanation; long technical copy and source links stay accessible. At 900px and below, the diagram, its controls, and the reader stack in normal document flow. The diagram receives its own height, while explanations expand naturally below it. Preserve this separation in both assembled and exploded states so artwork and labels do not cover the reading text. Wheel and touch gestures scroll this page rather than change chapters.

## Elevation & Depth

深度由粒子透视、远近透明度、缓慢转动和极轻的背景晕影构成，不使用卡片阴影。交互内容保持平面，主要靠细线与状态亮度区分。

WebGL 绘制 14,400 个主体点，每章三种、共十二种几何形态。切换保留解体、相机旋转 90°、重新聚合的过程，提供 Hex（2,400 ms）、Net（2,800 ms）与 Orbit（1,900 ms）三种过渡；默认 Auto 依次循环。文字先退出，约 740 ms 后重新进入；同章换形时文字保持稳定。每个形态重组完成后在前台展示满一分钟才换到下一种，暂停和隐藏页面都暂停计时。背景星云、星点和星尘由独立环境画布绘制。

粒子渲染器限制设备像素比到 1.7；不支持 WebGL 时使用约一半主体点的 Canvas 2D 回退。隐藏页面停止逐帧更新。系统减少动态偏好会关闭持续动画；用户也可使用页头暂停按钮。

The TableSync detail page uses an original SVG exploded diagram within the same atmosphere. Three projected plates share one perspective: a frontend schematic, server modules, and relational tables. Fine bevels, guide lines, and restrained tonal differences supply depth. Selecting a plate lifts it slightly and dims its neighbors. Color inside the miniature frontend drawing belongs to that schematic and does not create a new global accent token.

TableSync uses the Stars atmosphere with a subdued reading backdrop. Its opening assembly separates once; the Assemble / Explode control remains available afterward. Reduced motion starts with the layers exposed and removes transitions and smooth scrolling. The header pause control stops ambient movement and transition effects; page visibility also pauses the ambient scene. This detail page does not inherit the chapter sculpture's automatic form cycling.

## Shapes

界面形状来自点、线与字。导航点和图标按钮采用圆形；文章和项目使用无背景列表行。除了阅读页行内代码的小圆角，不引入圆角卡片。几何形体只存在于主视觉中，不与内容争夺可点击区域。

The Home chapter uses three original station sculptures from `station-forms.js`: Orbital habitat has a torus habitation ring; Solar research station combines a structural truss with solar panels; Deep-space gateway uses a pair of hexagonal docking structures. They share the established silver particle material and clipped stage.

## Components

### Personal signature

The home link uses a small silver handwritten `pl` signature from `assets/pl-signature.svg`. Its image box is 56×44px on desktop and 48×38px on compact screens; the link retains at least 44px of height. The same signature appears on the article and TableSync pages. Preserve the adjacent name label and existing accessible home-link names.

### Navigation

桌面左侧排列四个小圆点，当前项显示外圈与章节名；悬停和键盘焦点也可显示名称。手机将四点放到左下方。地址片段分别为 `#home`、`#writing`、`#projects`、`#about`，可直接进入对应章节。当前链接使用 `aria-current`。

### Icon buttons

页头提供暂停与浏览器全屏。桌面按钮为 42px 方形点击区，手机为 40px。悬停显示淡背景；暂停状态具有淡紫强调。浏览器不支持 Fullscreen API 时隐藏全屏入口。

### Links and lists

主链接使用底部细线与右箭头，悬停时增加文字与箭头间距。文章列表由元信息、标题和对角箭头组成，悬停只作小幅位移。项目列表使用原生 `details` / `summary`，一次展开一项。

### Field Notes

Journal keeps its navigation label and `#writing` route, while the page heading is “Field notes.” For now, the page contains only “Keeping TableSync in sync.” with a short description and a Read outline action. The compact CaseCraft and particle-experiment entries are hidden while their draft data remains available for later use. Fine rules and typography establish the hierarchy without cards or category filters. The TableSync entry is explicitly a draft preview, not a published article, and opens its matching outline in the reading page.

The chapter's particle forms come from `observation-forms.js`: an Orbital telescope with an open barrel and solar panels, Jupiter with a slightly oblate silhouette, wavy cloud bands and a silver oval storm, and a Stellar atlas with connected three-dimensional nodes in an open coordinate frame. Jupiter's rear surface is dimmed so its cloud bands read as a solid volume; its atmospheric details sit on the sphere rather than on detached rings. The established autorotation, transition and one-minute cycle remain in place. At widths up to 600px, this chapter alone uses a 23svh graphic stage to leave room for the story; the existing 58px separation above copy remains. Short screens retain the scrollable copy region.

Reading pages use a static, faint star field, ordinary document scrolling, and explicit Draft outline metadata. The TableSync outline has no next-note link while it is the sole Field Notes entry; its return link remains available. Existing sample-essay URLs and the other draft data remain accessible. No dates, reading-time claims, or authored project reflections are invented for draft content.

### Focus and motion

交互元素使用淡紫色 2px 焦点轮廓与 6px 外偏移。提供跳到当前章节的链接、屏幕阅读器章节播报和隐藏章节的 `inert` 状态。章节文字入场使用 `cubic-bezier(.16, 1, .3, 1)`；系统减少动态时关闭 CSS 动画和过渡。

### TableSync layer explorer

The Projects entry opens `tablesync.html`; its back link returns to `index.html#projects`. Overview, Frontend, Backend, and Database are synchronized tabs with address fragments of the same names in lowercase. Selecting a diagram layer, an overview row, a tab, or the next-layer control updates the explanation and diagram together. Selecting a layer from the assembled state exposes the stack. On small screens, selecting the diagram brings the reader into view.

Tabs use a roving tab stop, Left / Right Arrow navigation, and Home / End. Diagram plates accept click or tap, Enter / Space, and directional arrows. Selected tabs expose `aria-selected`; selected plates expose `aria-pressed`. A polite status message announces the chosen explanation, and a skip link reaches the reader. Assemble / Explode changes the diagram's spacing without changing the selected explanation.

Explanations use headings, prose, fine dividing lines, and collapsible implementation details within the established sparse style. Stack labels and a shared “finalize a menu” example connect the layers. Each explanation links to implementation files at the pinned TableSync commit `b70cd7ab4d333da134e9b38e594a28725e1fdeba`; simplified diagrams and pseudocode are identified as explanatory views. Source provenance and walkthrough details remain local to this project surface, rather than becoming global design rules.

## Do's and Don'ts

### Do:

- **Do** 保持用户已选择的深色粒子全屏方向。
- **Do** 让粒子与短标题形成主次关系，文章正文进入独立阅读页。
- **Do** 保留触控、键盘、滚轮与减少动态偏好的使用路径。
- **Do** 将新增文章样稿明确标为预览文稿。

### Don't:

- **Don't** 在未批准预览前，把本规范应用到主站或其他预览。
- **Don't** 将生成的阅读样稿当作作者真实发表的文章。
- **Don't** 以大块卡片、厚重阴影或额外强调色改变本预览的稀疏结构。


## Review refinement · September 19, 2026

用户认可整体方向，要求调整第四章粒子角度并丰富背景。本次仍只更新独立预览。

- 第四章星球与轨道共用倾斜轴；轨道展开为斜向宽环带，淡化被球体遮挡的背面点阵。
- 独立背景画布提供远近星点、蓝紫星云薄雾、星尘带和轻微视差；桌面文案区与手机下半区减弱背景亮度。
- 背景与主粒子共用暂停、系统减弱动态和章节状态；隐藏页停动，背景动画限制为 30 fps。
- 原有文字、文章阅读和全屏章节结构保持原实现。


## Site language

The user confirmed English for the entire public-facing preview. All chapter copy, navigation, controls, accessibility labels, metadata, errors, and sample essays use English. HTML uses `lang="en"`. Headings use -0.025em tracking and 1.22 line height; mobile chapter headings remain naturally spaced when their hard breaks collapse. Particle artwork and the ambient background retain their approved direction.

## Responsive motion refinement

The artwork owns a clipped stage and never overlaps the reading region, including during disassembly. Each chapter offers three forms with a visible form name, counter, and next-form control. A native Particle transition select shares their existing 40px-high row and offers Auto / Hex / Net / Orbit; changing it previews the next form immediately. Compact gaps, a narrower select, and form-name ellipsis keep the row within the 272px stage at a 320px viewport.

Chapter and form changes retain the disassemble → quarter-turn camera → reform sequence. Hex, named Hexagonal prism in the renderer, expands the points radially into a centered hexagonal prism shell, turns the camera 90°, then reassembles the next sculpture over 2,400 ms. The `fluid` mode identifier remains compatible with the existing API. Net spreads the points into 36 warp and 36 weft threads of 200 points each, waves the mesh, then gathers them over 2,800 ms. Orbit retains the original 1,900 ms particle-cloud transition. Auto cycles Hex → Net → Orbit. Copy reappears after about 740 ms while the artwork continues its transition; chapter input timing follows the active transition duration.

The 60,000 ms dwell clock advances only while the page is visible, motion is enabled, and the sculpture is settled. Pause and page hiding preserve the remaining time. Reduced motion keeps manual navigation instant and disables automatic cycling. Canvas 2D fallback retains the same transition variants and timing. Automatic artwork changes do not move focus or repeatedly announce to screen readers.

All twelve sculptures rotate continuously around their vertical axis, completing a full turn every 48 seconds. This shared model angle persists through form and chapter transitions, independently of the transition camera's quarter turn. Pause, page hiding, and reduced motion freeze the angle without catch-up on resume. WebGL and Canvas 2D apply the same render-time rotation, preserving local-space geometry and the stage's existing bounds.

## Atmosphere experiment · Meteors and aurora

The approved starfield remains the base. A header select compares Stars (incumbent), Meteors (occasional silver-blue streaks), and Aurora (a slow teal-green curtain with violet wisps and occasional meteors). Aurora is the preview default. The folds live mainly above and left of the sculpture; exposure falls around reading copy. Neighboring strands overlap with irregular widths to avoid rigid vertical bars.

One ambient 30 fps clock owns all background movement. Meteor lifetimes are 1.65–2.4 seconds with 8–20 second intervals; entry into an animated sky offers a first pass after 1.6 seconds. Pause and page visibility suspend the clock. Reduced motion shows static auroral light and omits meteors. The existing 12 foreground sculptures, transition sequence, English copy and reading pages remain intact.
