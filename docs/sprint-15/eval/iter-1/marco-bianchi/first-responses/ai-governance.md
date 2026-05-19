Here's the load-bearing analysis:

## Bottom Line: NOT High-Risk (with documentation)

The code-gen product falls on the **limited-risk** side of the boundary. Here's why:

### The Annex III(4) Category — Not Triggered

Annex III category 4 covers AI systems that:
- **(a)** Recruitment/selection — screening CVs, evaluating candidates
- **(b)** Employment **decisions**: promotion, termination, task **allocation to workers**, performance monitoring/evaluation

The key distinction: **who or what is being managed?**

| Annex III(4)(b) Concern | Your Product |
|------------------------|---------------|
| Task allocation based on worker behavior/personality | Your tool allocates tasks **to the model** (generating code), not to workers |
| Performance monitoring/evaluation of persons | No — engineers evaluate the output, not the tool evaluating engineers |
| Promotion/termination decisions | No — tool doesn't recommend or decide on human career outcomes |

**Your product generates code. It doesn't allocate work to people or evaluate people's work.** That's the critical divide.

### The Article 6(3) Exception — Not Needed (But Strong Backup)

Even if a regulator tried to argue the product "touches" category 4, Article 6(3) provides a carve-out for narrow procedural tasks that "improve a previously completed human activity" or "detect decision-making patterns without replacing human assessment." Code completion/suggestion fits squarely here: it improves engineer activity, doesn't replace the engineer's judgment, and is preparatory to an engineer's final output.

### Trigger Scenarios to Monitor

Where it **could** become high-risk if adapted:
1. **Product feature** that ranks engineers by productivity metrics
2. **Product feature** that recommends promotions or termination
3. **Product feature** that allocates tasks to developers algorithmically

**Recommendation**: Document the classification assessment per Article 6(4) pre-launch. Keep the product scope clear in marketing/policy docs: "code generation for engineers — not an employment management tool."

This mirrors what AugmentCode and others are saying: standard AI coding assistants fall outside Annex III when used for code synthesis, not workforce management.

Want me to draft the Article 6(4) classification memo for the matter folder?