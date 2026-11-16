# UI prototype

For "what should this look like". Build several structurally different variations the user can flip between in the browser.

1. **State the plan in one line.** For example: three variants of the settings page, switched by `?variant=`, on the existing `/settings` route. Default to three variants and never more than five.
2. **Use a real page.** Mount the variants on the existing route, with its real header, data and density. A variant always looks fine on an empty page. Create a throwaway route only when nothing existing could host it, and name it as a prototype.
3. **Make the variants disagree.** Different layout, different hierarchy, different main action. Colour or copy changes are not variants. If two drafts come out alike, redo one.
4. **Add one switcher.** A small fixed bar with previous, the current variant's name, and next. It updates the URL parameter so a variant survives a reload and can be shared, and it is hidden in production builds.
5. **Hand it over.** Give the user the URL and the variant keys. The usual answer is a mix, such as the header from B with the sidebar from C.

Keep the variants read-only, pointing any mutation at a stub. Share small components between variants, never the layout. The winning variant is rewritten properly when it goes into the real code.
