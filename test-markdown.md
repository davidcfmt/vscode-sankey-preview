# Multi-Layer Sankey Test

This tests the multi-layer functionality in markdown preview:

```sankey
// Multi-layer flows
Revenue --> Retail --> Online --> Mobile: 300
Revenue --> Retail --> Store --> Cash: 200
Revenue --> Cloud --> AWS --> Compute: 600
Revenue --> Cloud --> Azure --> Storage: 400

// Single layer (still works)
Direct --> Sales: 100

// Styling
class Revenue color:#2ECC71
class Retail color:#FFDD00
class Cloud color:#0099FF
class Online color:#FF6B6B
class Mobile color:#4ECDC4
class Store color:#FFE66D
class AWS color:#FF9F43
class Azure color:#6C5CE7
class Direct color:#9B59B6
```

## Expected Flow Structure

The diagram should show:

1. **Revenue** splits into:
   - **Retail** (500 total) which splits into:
     - **Online** (300) → **Mobile** (300)
     - **Store** (200) → **Cash** (200)
   - **Cloud** (1000 total) which splits into:
     - **AWS** (600) → **Compute** (600)  
     - **Azure** (400) → **Storage** (400)

2. **Direct** → **Sales** (100)

Total revenue flow: 1100 units
