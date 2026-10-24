# Immersive keyboard acceptance

## What changed

- The opening cover is a native modal dialog. Skipping it restores focus to the map control.
- The article body can receive Tab focus and has a visible focus outline, so the full text has a keyboard entry point.
- The existing “走進情境” task dialog shows the current scene protagonist's dialogue, derived from that scene's existing `dialogue` and character records. Its banner identifies the character and scene as fictional, while preserving the task's existing label and flow.
- The task dialog already uses the world encounter and speech APIs; closing it clears that conversation. The acceptance run reads this state back after the native `close` event.

## Real keyboard and touch run

Run from the repository root:

```sh
npm run build
node tests/immersive-keyboard-path-browser.mjs
```

The browser script uses one Chromium process and runs 390×844 and 1280×800 sequentially. It interacts with Tab, Shift+Tab, Enter, Space, Escape, PageDown, and `keyboard.type`; it does not set focus or activate controls through DOM scripts. Selectors are used to observe focus and state. On mobile, a real touchscreen tap supplements the keyboard recommendation route.

Both viewports passed the same main path:

1. Tab to the intro's skip button, Enter to close it, then verify focus returns to the map control. The native dialog's sequence briefly reports `BODY` between the skip button and the next Tab back to it; it never reaches a background interactive control.
2. Open settings and enable reduced motion with Enter and Space. Open the directory from the map control, type the P01 title into search, and Enter the matching article.
3. Open the reader, select the full original text with Space, Tab into the article, then use PageDown until the reader scroll position reaches at least one third of its scroll range. The observed scrollport is `#reader` (`overflow-y: auto`). At 390×844, scrollTop moved from 261 to 3650 and the visible text was paragraphs 23–25 of 60. At 1280×800, it moved from 288 to 2550 and paragraphs 23–30 were visible.
4. Tab to the note, type a note, Escape to close the reader, and reopen it after following a recommendation. The note is still present.
5. Space on “走進情境” opens the P01 task. It displays the existing protagonist line, “映蓁：「這張圖很真，但我還沒找到它從哪裡來。」”, and the fictional-scene label. Keyboard choices complete the source-check task and reveal its full result. Escape closes the dialog, returns focus to the task opener, and the world encounter/speech state clears.
6. Enter follows the P01 → P04 recommendation; Enter on “返回來源島 · P01” restores P01. The next return label still points to I01, and Enter restores I01.
7. On mobile, the recommendation button's bounding box is unchanged from `pointerdown` through `click`; its height is at least 44px. The reader remains within the 58dvh cap. There were no page errors.

The run writes detailed focus, scroll, touch, and state evidence to the ignored `test-results/immersive-keyboard-path/results.json` file and captures UI screenshots beside it:

- [390px full-text middle](../test-results/immersive-keyboard-path/390-reader-page-down.png)
- [1280px full-text middle](../test-results/immersive-keyboard-path/1280-reader-page-down.png)
- [390px character dialogue](../test-results/immersive-keyboard-path/390-character-dialogue.png)
- [390px completed task](../test-results/immersive-keyboard-path/390-task-result.png)
- [390px recommendation](../test-results/immersive-keyboard-path/390-recommendation-before.png)

## Build and limits

`npm run build` completed successfully. Vite emitted its existing warning that `./fonts/publication.css` is not present at build time and will be resolved at runtime; the source is served from `public/fonts/publication.css`.

The keyboard route opens the current scene's main protagonist through the existing task entry. It does not add a general keyboard-selectable roster for every 3D character. Screenshots and browser JSON stay in ignored `test-results/`; the source and acceptance script are the committed deliverables. No 68-scenario matrix, performance run, push, or deployment was part of this change.
