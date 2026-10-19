# Security

Festival Navigator has no accounts: a crew's link is the key to that crew's
board, and your "My link" is the key to every crew you're in. So the thing
that matters most is simple. Nobody should be able to read or change a crew
they don't hold the link for.

## Found a way in? Tell me privately

Please use GitHub's private report: the **Security** tab of this repo, then
**Report a vulnerability**. Only the maintainer sees it. Include what you
did and what you could see or change; a short note is plenty.

Please don't open a public issue for it, and never paste a crew link (an
address with `#g=` in it) or a "My link" into an issue, a pull request or a
screenshot. That link IS access to real people's plans. If you need to show
one, make a throwaway crew and blank out the part after `#`.

## What's in scope

- Reading or writing a crew, a person record or notes without its link.
- A crew link or person token leaking somewhere it shouldn't (a log, a
  report, another site).
- Anything that makes the live app at fest.kevinhg.com run someone else's
  code.

This is a personal project kept by one person, so replies come when I can,
usually within a few days. Thank you for looking out for the people using
it.
