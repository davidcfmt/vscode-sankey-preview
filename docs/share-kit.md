# Sankey Markdown Preview Share Kit

Use these snippets after publishing a new Marketplace version.

## Short Post

I updated Sankey Markdown Preview for VS Code.

It lets you write Sankey flow diagrams directly in Markdown:

```sankey
Revenue --> Product: 1200
Revenue --> Services: 800
```

The new version adds local D3 Sankey rendering, SVG/PNG export, Mermaid `sankey-beta` copy, title/unit/value formatting, and clearer examples for energy, budget, funnel, and material-flow diagrams.

Marketplace:
https://marketplace.visualstudio.com/items?itemName=DavidCampbell.sankey-markdown-preview

## Longer Post

I shipped a new version of Sankey Markdown Preview, a small VS Code extension for writing flow diagrams in Markdown research notes and `.sankey` files.

Sankey diagrams are useful when link width should mean something: energy flow, material flow, budget allocation, revenue split, funnel drop-off, or dependency/effort flow.

This update keeps authoring friendly:

```sankey
title: Project budget
unit: USD
valueFormat: compact

Grant --> Research: 42000
Grant --> Equipment: 18000
Grant --> Publication: 9000
```

New in this release:

- Local/offline rendering with bundled `d3-sankey`
- Explicit `sankey` Markdown fences only
- SVG and PNG export
- Copy as Mermaid `sankey-beta`
- Optional title, unit, value formatting, link color, node alignment, and node colors
- Balance warnings for intermediate nodes

Marketplace:
https://marketplace.visualstudio.com/items?itemName=DavidCampbell.sankey-markdown-preview

GitHub:
https://github.com/davidcfmt/vscode-sankey-preview

## Places To Share

- GitHub release notes for `v2.1.0`
- LinkedIn, especially with the preview image
- Reddit communities focused on VS Code, data visualization, Markdown, or research workflows
- A short blog post or GitHub Discussions thread showing one energy-flow and one budget-flow example

## Suggested Screenshot Caption

Write Sankey diagrams beside your notes, preview them locally in VS Code, export SVG/PNG, and copy Mermaid when you need portability.

## Keywords To Work Into Posts

- Sankey diagram
- Markdown preview
- VS Code extension
- Mermaid Sankey
- D3 Sankey
- Flow diagram
- Energy flow
- Material flow
- Budget allocation
- Data visualization
