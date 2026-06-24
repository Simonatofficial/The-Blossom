# Why is my Claude usage running out so fast?

Hand this whole file to your coding agent. Save it, then say:

> "Read this file and help me figure out why my usage is so high. Explain simply, and ask me before changing any settings."

---

## Most likely cause: Opus plus high thinking effort

Opus is the most powerful model, and also by far the most expensive to run. "High effort" (extended thinking) makes it use many more tokens per answer. On a $20 plan, one big prompt on Opus at high effort can eat a large chunk of your limit in a single go.

The simple fix: use **Sonnet** for almost everything. Save Opus for rare, genuinely hard problems. Keep thinking effort **low or medium** unless you truly need deep reasoning.

---

## For your agent: check these, explain each simply, suggest the easiest fix

1. **Which model is selected?** Opus costs several times more per answer than Sonnet. Recommend Sonnet as the everyday default.
2. **Is high thinking effort turned on?** It multiplies token use. Recommend turning it down for normal building.
3. **How long is this chat session?** Every new message re-sends the whole conversation so far, so long chats get expensive fast. Recommend starting a fresh chat between unrelated tasks.
4. **How big are the project instruction files (like a CLAUDE.md)?** They are re-read every turn. If they are long, suggest trimming to the essentials.
5. **Are large files being pulled into the chat?** That text gets re-sent every turn. Suggest opening only the parts that are needed.
6. **Are there extra tools or integrations (MCP servers) loaded?** They add weight to every message. Suggest turning off any not in use.

For each item: say what you found in plain words, then the single simplest change. Do not change anything until the user says yes.

---

## Habits that save the most

- Use Sonnet by default. Reach for Opus only when you are truly stuck.
- Keep thinking effort low or medium for everyday building.
- Start a new chat when you switch to a different task.
- Keep your project instructions short.
- Point the agent at files instead of pasting big chunks.
