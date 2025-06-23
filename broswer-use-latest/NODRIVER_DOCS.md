# Nodriver Comprehensive Reference Guide

This document provides a detailed summary of the key classes, methods, and properties in the `nodriver` library, based on the official documentation. This is our source of truth to ensure correct usage.

## Core Concepts

- **Asynchronous**: All operations that involve interacting with the browser are `async` and must be `await`-ed, unless specified otherwise.
- **No WebDriver**: `nodriver` communicates directly with the browser via the Chrome DevTools Protocol (CDP), making it faster and harder to detect.
- **Element Finding**: The library offers multiple ways to find elements, each with a specific use case.
  - `tab.find()`: Best for finding a single, unique element by its visible text or a simple selector. It intelligently waits and has a `best_match` flag for text searches.
  - `tab.select()`: The standard method for finding a single element using a specific CSS selector.
  - `tab.select_all()`: The standard method for finding a list of all elements matching a CSS selector.
  - `tab.xpath()`: For finding elements using an XPath query.

---

## `Browser` Class

Represents the browser instance. Created via `uc.start()`.

### Key Properties

- `main_tab`: The first tab that is opened.
- `tabs`: A list of all currently open tabs.
- `cookies`: A `ContraDict` object for managing browser cookies.

### Key Methods

- **`await uc.start(**kwargs)`**:
  - **Description**: Launches a browser instance. This is the entry point.
  - **`headless` (bool)**: Run in headless mode.
  - **`browser_args` (list)**: A list of command-line arguments to pass to the browser process (e.g., `['--window-size=1920,1080']`).
  - **`user_data_dir` (str)**: Path to a user profile directory.
  - **Usage**: `browser = await uc.start(headless=False)`

- **`await browser.get(url, new_tab=False, new_window=False)`**:
  - **Description**: Navigates the main tab to a URL. Returns a `Tab` object.
  - **Usage**: `tab = await browser.get('https://example.com')`

- **`browser.stop()`**:
  - **Description**: Closes the browser and cleans up. **This is SYNCHRONOUS and must NOT be awaited.**
  - **Usage**: `browser.stop()`

- **`await browser.sleep(seconds)`**:
  - **Description**: Pauses the browser's execution.
  - **Usage**: `await browser.sleep(5)`

---

## `Tab` Class

Represents a single browser tab. This is where most interactions happen.

### Navigation and Page Interaction

- **`await tab.get(url)`**: Navigates the current tab to a new URL.
- **`await tab.reload()`**: Reloads the current page.
- **`await tab.back()`**: Navigates back in the session history.
- **`await tab.forward()`**: Navigates forward in the session history.
- **`await tab.close()`**: Closes the tab.
- **`await tab.bring_to_front()`**: Focuses the tab, making it the active one.
- **`await tab.wait_for(event, timeout=30)`**: Pauses execution until a specific CDP event occurs (e.g., `'Page.loadEventFired'`).

### Element Finding

- **`await tab.find(text_or_selector, best_match=True, timeout=10)`**: Finds a single element by text or selector.
- **`await tab.find_all(selector)`**: Finds a list of all elements matching a CSS selector.
- **`await tab.select(selector, timeout=10)`**: Finds a single element by CSS selector.
- **`await tab.select_all(selector)`**: Finds a list of all elements matching a CSS selector.
- **`await tab.xpath(query)`**: Finds elements using an XPath query.
- **`await tab.evaluate(js_expression)`**: Executes a JavaScript expression in the page context and returns the result.
- **`await tab.send(cdp_command, **params)`**: Sends a raw Chrome DevTools Protocol command and returns the result. This is for advanced use.
- **`await tab.sleep(seconds)`**: Pauses execution for a fixed duration.

### Mouse and Keyboard

- **`await tab.mouse.click(x, y)`**: Clicks at specific `(x, y)` coordinates.
- **`await tab.mouse.move(x, y)`**: Moves the mouse to specific coordinates.
- **`await tab.mouse.drag(x, y)`**: Drags the mouse from its current position to the specified coordinates.

### Scrolling

- **`await tab.scroll_down(pixels=100)`**: Scrolls the page down.
- **`await tab.scroll_up(pixels=100)`**: Scrolls the page up.
- **`await tab.scroll_bottom_reached()`**: Returns `True` if the bottom of the page is reached.

### Content and Screenshots

- **`await tab.get_content()`**: Returns the full HTML content of the page.
- **`await tab.save_screenshot(path)`**: Saves a screenshot of the current viewport to the specified file path. **It does not return data directly.**

---

## `Element` Class

Represents a single HTML element on the page.

### Key Properties

- **`element.text`**: The visible text content of the element.
- **`element.attributes`**: A dictionary of the element's HTML attributes.
- **`element.parent`**: The parent `Element`.

### Key Methods

- **`await element.mouse_click()`**: Clicks the center of the element. This is often more reliable than coordinate-based clicks if you have the element.
- **`await element.send_keys(text, delay=0)`**: Simulates typing into the element.
- **`await element.send_file(path)`**: Uploads a file to an `<input type="file">` element. **This is the correct method for file uploads.**
- **`await element.scroll_into_view()`**: Scrolls the page until the element is visible.
- **`await element.focus()`**: Sets the focus on the element.
- **`await element.clear_input()`**: Clears any text from an input field.
- **`await element.get_position()`**: Returns a dictionary with the element's position and dimensions (`x`, `y`, `width`, `height`).
- **`await element.get_html()`**: Returns the outer HTML of the element.
- **`await element.save_screenshot(path)`**: Saves a screenshot of just this specific element.
- **`await element.flash()`**: Briefly highlights the element on the page, useful for debugging. 