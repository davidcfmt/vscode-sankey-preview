# Sankey Diagram Test

This file demonstrates Sankey diagrams rendered in Markdown preview with the same examples as `test.sankey`.

## Simple Flows

Basic two-node flows showing revenue distribution:

```sankey
Revenue --> Expenses: 800
Revenue --> Savings: 200
class Revenue color:#2ECC71
class Expenses color:#E74C3C
class Savings color:#3498DB
```

## Multi-Layer Marketing Flow

Complex chained flows showing how sales flow through marketing channels:

```sankey
Sales --> Marketing --> Digital --> Social: 150
Sales --> Marketing --> Traditional --> TV: 100
Sales --> Marketing --> Traditional --> Radio: 50

class Sales color:#FF6B6B
class Marketing color:#4ECDC4
class Digital color:#45B7D1
class Traditional color:#96CEB4
class Social color:#FFEAA7
class TV color:#DDA0DD
class Radio color:#74B9FF
```

## Business Process Flow

Production process with quality control and waste management:

```sankey
Input --> Processing --> Quality --> Output: 300
Input --> Processing --> Waste --> Disposal: 50
Input --> Direct --> Output: 100

class Input color:#00B894
class Processing color:#FDCB6E
class Quality color:#6C5CE7
class Waste color:#A29BFE
class Direct color:#FD79A8
class Output color:#00CEC9
class Disposal color:#636E72
```

## Energy Distribution

Renewable energy sources flowing to home consumption:

```sankey
Solar --> Battery --> Home: 400
Solar --> Grid --> Home: 200
Wind --> Battery --> Home: 150
Wind --> Grid --> Home: 250

class Solar color:#FFD93D
class Wind color:#6C5CE7
class Battery color:#00B894
class Grid color:#74B9FF
class Home color:#FD79A8
```

## Features Demonstrated

- ✅ Simple two-node flows
- ✅ Multi-layer chained flows (A → B → C → D)
- ✅ Complex branching and merging
- ✅ Custom node colors
- ✅ Multiple flow scenarios
- ✅ Comments and documentation

These diagrams should render as interactive Sankey visualizations with flowing curves and proportional widths.
