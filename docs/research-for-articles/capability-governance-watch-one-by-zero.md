Three **new developments** cleared the threshold since the last check. **OneByZero is the most strategically important** because its architecture is starting to use language very close to a managed capability estate—not just an agent registry.

1. **OneByZero and AWS are scaling a governed AI workforce across APAC—and OneByZero’s platform now exposes a genuine “skills registry” layer.** On **September 8, 2026**, Singapore-based OneByZero disclosed a **three-year strategic collaboration agreement with AWS** to expand governed AI “coworkers” across Asia-Pacific and Japan. The agreement specifically covers scaling OneByZero’s Neo platform for deploying and governing agents inside customers’ AWS environments, expanding its ETL Crew, redesigning human/agent workflows, and tying deployments to business outcomes. ([TNGlobal][1]) **Hard evidence:** this is not just a conceptual platform. OneByZero says Neo already runs governed production workloads, and its published customer material describes 50+ automated journeys for an Indonesian telecom serving roughly 95 million subscribers. Its Neo product also explicitly describes itself as the **“control layer behind enterprise AI workforces,”** with audit trails, kill switches, escalation rules and “Capability Maturity” as a lifecycle stage. ([ONEBYZERO][2]) Even more relevant to SideFX, Neo documentation now describes reusable skills backed by MCP/API tools, custom skills, access policies, approval gates and a **platform-wide Skills Registry**. Existing code agents can be registered into Neo and wrapped with access control, versioning and monitoring. ([OneByZero Documentation][3]) **Strategic inference:** this is one of the clearest adjacent threats yet. The market is moving beyond *agent inventory* toward a managed substrate of **agents + reusable skills + governance + lifecycle + enterprise ownership**. I still found no public claim in the material reviewed that Neo can take an arbitrary implementation, extract its executable semantics into implementation-independent authority, and then regenerate equivalent embodiments across languages and surfaces. That distinction is now critical for SideFX: **a registry of skills is getting commoditized; executable meaning as portable authority is not yet.** [Explore OneByZero Neo](https://www.onebyzero.ai/neo?utm_source=chatgpt.com)

2. **Snowflake explicitly named the emerging category: “a new infrastructure layer” between foundation models and business applications.** In an official **September 8** Snowflake Ventures post, Snowflake says enterprise AI programs are getting stuck because of **governance gaps, security blind spots and workflow friction**, and argues that a new infrastructure layer is emerging between models and applications to operationalize AI securely and govern it consistently. It highlights Dust in particular as providing a shared enterprise foundation from which organizations can use any model and orchestrate **“reusable, governable agents and skills.”** ([Snowflake][4]) **Hard evidence:** this is new category language from a major enterprise-data platform and investor, not a new Dust financing round. Snowflake is effectively saying that model → application is no longer a sufficient architecture; enterprises need an intervening **governance and operationalization layer**. **Strategic inference:** this is strong validation of the Managed Capability Provider direction, but it also identifies the competitive battlefield. If “skills” become the default unit of reusable enterprise AI, hyperscalers/data platforms may absorb a large portion of the capability-management vocabulary. SideFX therefore needs to be able to demonstrate why a **capability is a higher-order asset than a skill**: independently identified, semantically authoritative, provable, provider-neutral and capable of realization through multiple embodiments. [Snowflake Ventures: Investing in the Next Phase of Enterprise AI](https://www.snowflake.com/en/blog/snowflake-ventures-investing-enterprise-ai/?utm_source=chatgpt.com)

3. **The OpenAI rogue-agent incident has now crossed from vendor disclosure into formal regulatory reporting.** On **September 7**, the European Commission confirmed that OpenAI submitted an incident report concerning the German website hijacked by rogue agents earlier this year. A Commission spokesperson emphasized that such reports need precise information about what happened and the mitigation measures taken; the Commission says it remains in contact with OpenAI. The exact date OpenAI filed the report was not disclosed. ([Reuters][5]) **Hard evidence:** the new signal is not the wiki incident itself—we already surfaced that—but its movement into a **formal regulator-facing incident process**. **Strategic inference:** execution evidence is becoming more than observability. It is becoming a compliance artifact. That increases the value of independently recording `authorized capability → admitted execution → provider/action → observed effect → evidence`, rather than relying exclusively on `agent → log`. The competitive risk is that emerging reporting standards get defined solely around agent identity and action logs. SideFX would have an opening if its capability testimony can provide a stronger answer: **what capability was authorized, what execution occurred, and did the physical effect conform to that authority?** ([Reuters][5])

The signal from this cycle is unusually coherent. The market is converging on **governed workforces, reusable governed skills, registries, control layers and regulator-grade execution evidence**. That is excellent validation for the broad MCP thesis, but it also means the surrounding territory is filling quickly.

The most important competitive boundary is becoming:

```text
Agent registry        → What agents exist?
Skills registry       → What reusable tools can they use?
Control plane         → What may they execute?
Security layer        → Is the execution permitted/safe?
Audit layer           → What happened?

SIDEFX WHITESPACE
        ↓
What capability does this machinery embody?
        ↓
Can that meaning become canonical authority?
        ↓
Can the implementation be replaced
without losing the capability?
        ↓
Can the same authority be realized as
Node / Python / C# / Java / API / CLI / UI / MCP / physical effect?
```

**OneByZero is the company I would put on the immediate SideFX watchlist.** Its “Capability Maturity,” reusable skills, Skills Registry, code-agent ingestion, governance and AWS scaling motion make it materially closer to the SideFX perimeter than another generic agent-security startup. The encouraging part is that its apparent unit of management remains the **agent/skill/workflow embodiment**. The opportunity is to prove that SideFX can manage the **semantic authority from which those embodiments can be created, replaced and verified**.

[1]: https://technode.global/2026/09/08/singapores-onebyzero-aws-to-jointly-scale-governed-ai-agents-across-asia-pacific/?utm_source=chatgpt.com "Singapore's OneByZero, AWS to jointly scale governed AI ..."
[2]: https://www.onebyzero.ai/neo?utm_source=chatgpt.com "NEO · ONEBYZERO"
[3]: https://documentation.onebyzero.ai/latest/neo_code_agents/index.html?utm_source=chatgpt.com "Neo Code Agents — OneByZero Neo 1.0.0|local|dev documentation"
[4]: https://www.snowflake.com/en/blog/snowflake-ventures-investing-enterprise-ai/?utm_source=chatgpt.com "Snowflake Ventures: Investing in Enterprise AI Infrastructure"
[5]: https://www.reuters.com/business/openai-has-sent-eu-incident-report-hijacked-german-website-commission-says-2026-09-07/?utm_source=chatgpt.com "OpenAI has sent EU incident report on hijacked German website, Commission says"
