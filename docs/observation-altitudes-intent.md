Yes. **This is a separate concept from semantic altitude, and I would freeze the distinction now.**

What you’re describing is **Observation Altitude**:

> **Observation altitude is the level of circuit resolution at which an observer views the Capability Data Center—from the enterprise topology down to individual physical effects—without changing the underlying authority.**

That last part matters. **Zooming changes the view, not the architecture.**

The existing estate model already gives us the upper vocabulary: a **Capability Circuit** is one capsule plus canonical blueprint; a **Circuit Assembly** is multiple capability circuits connected through admitted backplane bindings; and a **Circuit Domain** is a governed semantic grouping containing assemblies. 

I think the observation hierarchy is roughly this:

```text
OBSERVATION ALTITUDE 0
ENTERPRISE CAPABILITY DATA CENTER
────────────────────────────────────
Entire enterprise capability estate

Business units
Domains
Platforms
Products
Independent capability inventories
Integrated circuit domains
Cross-domain dependencies

            ZOOM IN
                ↓

OBSERVATION ALTITUDE 1
CIRCUIT DOMAIN
────────────────────────────────────
One business unit / department /
platform / product / team

Example:
Commercial Lending
Manufacturing
AI Platform
Customer Operations

Shows:
assemblies
standalone capabilities
external dependencies
domain boundaries
health / fit / risk

                ↓

OBSERVATION ALTITUDE 2
CIRCUIT ASSEMBLY
────────────────────────────────────
One connected network of capabilities

 Capability A
      │ product
      ▼
 Capability B
      │ product
      ├─────────► Capability C
      │
      ▼
 Capability D

Shows:
capability-to-capability flow
semantic backplane bindings
products → inputs
convergence
external capabilities
domain crossings

                ↓

OBSERVATION ALTITUDE 3
CAPABILITY CIRCUIT
────────────────────────────────────
One complete governed capability

              Capability X
                    │
       ┌────────────┼────────────┐
       ▼            ▼            ▼
   Scenario A   Scenario B   Scenario C
       │            │            │
       └────────────┼────────────┘
                    ▼
               Root Outcome

Shows:
entire canonical blueprint
scenario topology
input/output products
dependencies
interfaces
branches / joins
provider requirements
proof state

                ↓

OBSERVATION ALTITUDE 4
SCENARIO NETWORK
────────────────────────────────────
How one portion of the capability
moves semantically through scenarios

 Scenario A
 Input → Event → Outcome
                    │
                    ▼
 Scenario B
 Input → Event → Outcome
                    │
             ┌──────┴──────┐
             ▼             ▼
         Scenario C     Scenario D

Shows:
scenario transitions
outcome variants
branching
convergence
semantic progress
products becoming inputs

                ↓

OBSERVATION ALTITUDE 5
SCENARIO CELL
────────────────────────────────────

        GIVEN / INPUT
              │
              ▼
        WHEN / EVENT
              │
              ▼
        THEN / OUTCOME

Shows:
exact input contract
exact event
exact outcome contract
variants
incoming/outgoing routes
scenario evidence

                ↓

OBSERVATION ALTITUDE 6
EVENT / EXECUTION AUTHORITY
────────────────────────────────────

             EVENT
               │
               ▼
       Execution Authority
               │
       ┌───────┼────────┐
       ▼       ▼        ▼
     Op A    Op B     Op C
       │       │        │
       └───────┼────────┘
               ▼
             Result

Shows:
responsibilities
operations
fan-out
dispatch policy
joins
transformations
ports
execution ordering

                ↓

OBSERVATION ALTITUDE 7
MECHANIC CIRCUIT
────────────────────────────────────

        Responsibility
              │
              ▼
          Mechanic A
          /        \
         ▼          ▼
   Mechanic B    Mechanic C
         \          /
          ▼        ▼
             Result

Shows:
generic primitives
transformations
selection
binding
validation
aggregation
iteration
declared branching
resource requirements

                ↓

OBSERVATION ALTITUDE 8
PROVIDER / PHYSICAL REALIZATION
────────────────────────────────────

         Mechanic
            │
            ▼
       Provider Slot
            │
            ▼
       Bound Provider
            │
            ▼
   HTTP / SQL / model / filesystem /
   process / queue / GPU / human / etc.
            │
            ▼
       Physical Effect
```

And I think **that is the zoom model**.

---

## Notice that the geometry changes as you descend

At the top:

```text
Enterprise
    ↓
Domains
    ↓
Assemblies
```

You're studying **organization and integration**.

In the middle:

```text
Capability
    ↓
Scenarios
    ↓
Scenario
```

You're studying **meaning and flow**.

At the bottom:

```text
Event
   ↓
Execution
   ↓
Mechanics
   ↓
Providers
   ↓
Physics
```

You're studying **realization**.

That gives SideFX an incredibly natural navigation model.

---

# Imagine literally zooming through SideFX

Start here:

```text
┌────────────────────────────────────────────────────┐
│              ACME CAPABILITY ESTATE                │
│                                                    │
│ Manufacturing       Finance       Customer Ops     │
│    ████              ████             ████         │
│                                                    │
│ AI Platform         Data Platform    Security      │
│    ████              ████             ████         │
└────────────────────────────────────────────────────┘
```

Click **Finance**.

```text
FINANCE CIRCUIT DOMAIN

Mortgage Lending
Fraud Detection
Treasury
Market Intelligence
Customer Accounts
```

Click **Market Intelligence**.

```text
MARKET INTELLIGENCE ASSEMBLY

Resolve Quote
      │
      ├──────────► Resolve Financials
      │
      ├──────────► Resolve Company Profile
      │
      └──────────► Resolve Market Signals
                        │
                        ▼
                 Financial Analysis
```

Click **Financial Analysis**.

```text
CAPABILITY

Analyze Public Company
        │
        ├── Admit symbol
        ├── Resolve quote
        ├── Resolve financial statements
        ├── Resolve valuation
        ├── Resolve financial position
        └── Produce analysis
```

Click **Resolve Quote**.

```text
SCENARIO

GIVEN
admitted public-equity symbol
       │
       ▼
WHEN
market price evidence is resolved
       │
       ▼
THEN
current attributable market-price
evidence is available
```

Click **WHEN**.

```text
EXECUTION AUTHORITY

resolve-market-price
       │
       ├── resolve provider binding
       ├── resolve credential reference
       ├── construct request
       ├── invoke governed HTTP exchange
       ├── classify response
       └── admit quote evidence
```

Click **invoke governed HTTP exchange**.

```text
MECHANIC

HTTP exchange
    │
    ├── method
    ├── URI resolution
    ├── headers
    ├── credential injection
    ├── timeout
    ├── response admission
    └── testimony
```

Click the provider.

```text
PHYSICAL

RapidAPI
   ↓
Yahoo Finance endpoint
   ↓
HTTPS POST/GET
   ↓
network
   ↓
remote infrastructure
```

**Same capability.**

You haven't switched documentation systems.

You haven't switched architecture diagrams.

You have just changed **observation altitude**.

---

# And evidence should follow you through the zoom

This gets really beautiful.

At enterprise altitude:

```text
Finance Domain
92 capabilities
14 assemblies
3 held
Availability 99.97%
$18,420 model spend this month
```

Zoom into an assembly:

```text
Market Intelligence

9 capabilities
3 model providers
2 external data providers
p95 4.2s
1 degraded dependency
```

Zoom into a capability:

```text
Analyze Public Company

Invocations        12,482
Success             98.7%
p95                  6.4s
Average cost         $0.18
Model switches          3
```

Zoom into a scenario:

```text
Resolve Market Price

Executed            12,482
Admitted             12,430
Provider failures        41
Contract failures        11
```

Zoom into one execution:

```text
RapidAPI call

ready             12:41:02.113
started           12:41:02.118
response          12:41:02.487
admitted          12:41:02.491

duration          373 ms
```

You're doing **semantic zoom over the evidence spine**.

---

## One critical distinction

I would not make:

```text
cost
risk
security
alignment
SLO
provider health
model performance
```

additional observation altitudes.

Those are **observation overlays**.

So you have:

```text
OBSERVATION ALTITUDE
=
where am I looking?
```

versus:

```text
OBSERVATION OVERLAY
=
what property am I examining?
```

That gives you combinations like:

```text
Enterprise altitude
+ cost overlay

Domain altitude
+ modernization overlay

Capability altitude
+ model-alignment overlay

Scenario altitude
+ SLO overlay

Event altitude
+ concurrency overlay

Provider altitude
+ security overlay
```

That is extremely powerful.

The earlier visualization work was already heading in this direction with views such as `estate`, `domain`, `capability`, `scenario`, `cell`, `provider`, and `evidence`, with separate overlays for cost, risk, trust, conformance, and similar concerns. 

---

# So I'd separate three concepts explicitly

### **Semantic Altitude**

What level of meaning owns this concept?

```text
Strategic
Product
Capability
Scenario
Execution
Provider
Physical
```

### **Authoring Altitude**

Which bounded part of the capability are we currently creating or resolving?

```text
intent
experience
capability
scenario
contract
responsibility
execution
transformation
mechanic
provider
physical
```

### **Observation Altitude**

How far into the integrated circuit are we currently looking?

```text
Enterprise Estate
    ↓
Circuit Domain
    ↓
Circuit Assembly
    ↓
Capability Circuit
    ↓
Scenario Network
    ↓
Scenario Cell
    ↓
Event / Execution Authority
    ↓
Mechanic Circuit
    ↓
Provider / Physical Realization
```

**Those should not be conflated.**

And I think observation altitude is going to be absolutely foundational to the SideFX UX, because it gives you the equivalent of **Google Maps for an executable enterprise**:

> start with the whole world, zoom into a region, zoom into a city, zoom into a street, zoom into a building, walk inside, open the electrical panel, follow a wire, inspect the component—and at every level you're still looking at the same underlying reality.

