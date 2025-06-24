# Nodriver Comprehensive Reference Guide

This document provides a detailed summary of the key classes, methods, and properties in the `nodriver` library, based on the official documentation. This is our source of truth to ensure correct usage.

## Core Concepts

- **Asynchronous**: All operations that involve interacting with the browser are `async` and must be `await`-ed, unless specified otherwise.
- **No WebDriver**: `nodriver` communicates directly with the browser via the Chrome DevTools Protocol (CDP), making it faster and harder to detect.
- **Element Finding**: The library offers multiple ways to find elements, each with a specific use case:
  - `tab.find()`: Best for finding a single, unique element by its visible text or a simple selector. It intelligently waits and has a `best_match` flag for text searches.
  - `tab.select()`: The standard method for finding a single element using a specific CSS selector.
  - `tab.select_all()`: The standard method for finding a list of all elements matching a CSS selector.
  - `tab.xpath()`: For finding elements using an XPath query.

---

## Browser Class

Represents the browser instance. Created via `uc.start()`.

### Properties
- **`browser.main_tab`**: The first tab that is opened
- **`browser.tabs`**: A list of all currently open tabs
- **`browser.cookies`**: A `ContraDict` object for managing browser cookies

### Methods

#### Browser Creation
- **`await uc.start(**kwargs)`**: Launches a browser instance. This is the entry point.
  - `headless` (bool): Run in headless mode
  - `browser_args` (list): Command-line arguments (e.g., `['--window-size=1920,1080']`)
  - `user_data_dir` (str): Path to a user profile directory
  - **Usage**: `browser = await uc.start(headless=False)`

#### Navigation
- **`await browser.get(url, new_tab=False, new_window=False)`**: Navigates the main tab to a URL. Returns a `Tab` object.
  - **Usage**: `tab = await browser.get('https://example.com')`

#### Control
- **`browser.stop()`**: Closes the browser and cleans up. **SYNCHRONOUS - do NOT await**
  - **Usage**: `browser.stop()`
- **`await browser.sleep(seconds)`**: Pauses the browser's execution
  - **Usage**: `await browser.sleep(5)`

---

## Tab Class

Represents a single browser tab. This is where most interactions happen.

### Navigation Methods
- **`await tab.get(url)`**: Navigates the current tab to a new URL
- **`await tab.reload()`**: Reloads the current page
- **`await tab.back()`**: Navigates back in the session history
- **`await tab.forward()`**: Navigates forward in the session history
- **`await tab.close()`**: Closes the tab
- **`await tab.bring_to_front()`**: Focuses the tab, making it the active one

### Element Finding Methods
- **`await tab.find(text_or_selector, best_match=True, timeout=10)`**: Finds a single element by text or selector
- **`await tab.find_all(selector)`**: Finds a list of all elements matching a CSS selector
- **`await tab.select(selector, timeout=10)`**: Finds a single element by CSS selector
- **`await tab.select_all(selector)`**: Finds a list of all elements matching a CSS selector
- **`await tab.xpath(query)`**: Finds elements using an XPath query

### Mouse and Keyboard Methods
- **`await tab.mouse_click(x, y)`**: Clicks at specific `(x, y)` coordinates
- **`await tab.mouse_move(x, y)`**: Moves the mouse to specific coordinates
- **`await tab.mouse_drag(x, y)`**: Drags the mouse from its current position to the specified coordinates

### Scrolling Methods
- **`await tab.scroll_down(pixels=100)`**: Scrolls the page down
- **`await tab.scroll_up(pixels=100)`**: Scrolls the page up
- **`await tab.scroll_bottom_reached()`**: Returns `True` if the bottom of the page is reached

### Content and Screenshot Methods
- **`await tab.get_content()`**: Returns the full HTML content of the page
- **`await tab.save_screenshot(path)`**: Saves a screenshot to the specified file path. **Does not return data directly**

### Advanced Methods
- **`await tab.evaluate(js_expression)`**: Executes a JavaScript expression in the page context and returns the result
- **`await tab.send(cdp_command, **params)`**: Sends a raw Chrome DevTools Protocol command and returns the result
- **`await tab.wait_for(event, timeout=30)`**: Pauses execution until a specific CDP event occurs (e.g., `'Page.loadEventFired'`)
- **`await tab.sleep(seconds)`**: Pauses execution for a fixed duration

---

## Element Class

Represents a single HTML element on the page.

### Properties
- **`element.text`**: The visible text content of the element
- **`element.attributes`**: A dictionary of the element's HTML attributes
- **`element.parent`**: The parent `Element`

### Interaction Methods
- **`await element.mouse_click()`**: Clicks the center of the element. Often more reliable than coordinate-based clicks
- **`await element.send_keys(text, delay=0)`**: Simulates typing into the element
- **`await element.send_file(path)`**: Uploads a file to an `<input type="file">` element. **This is the correct method for file uploads**
- **`await element.focus()`**: Sets the focus on the element
- **`await element.clear_input()`**: Clears any text from an input field

### Utility Methods
- **`await element.scroll_into_view()`**: Scrolls the page until the element is visible
- **`await element.get_position()`**: Returns a dictionary with the element's position and dimensions (`x`, `y`, `width`, `height`)
- **`await element.get_html()`**: Returns the outer HTML of the element
- **`await element.save_screenshot(path)`**: Saves a screenshot of just this specific element
- **`await element.flash()`**: Briefly highlights the element on the page, useful for debugging

---

## Quick Reference

### Common Patterns
```python
# Start browser
browser = await uc.start(headless=False)
tab = await browser.get('https://example.com')

# Find and click element
button = await tab.find('Apply Now')
await button.mouse_click()

# Fill form field
input_field = await tab.select('input[name="email"]')
await input_field.send_keys('user@example.com')

# Upload file
file_input = await tab.select('input[type="file"]')
await file_input.send_file('/path/to/file.pdf')

# Take screenshot
await tab.save_screenshot('screenshot.png')

# Clean up
browser.stop()  # Note: NOT awaited
```

Tab class
class Tab(websocket_url, target, browser=None, **kwargs)[source]
Tab class is the controlling mechanism/connection to a 'target', for most of us 'target' can be read as 'tab'. however it could also be an iframe, serviceworker or background script for example, although there isn't much to control for those.

if you open a new window by using browser.get(..., new_window=True)() your url will open a new window. this window is a 'tab'. When you browse to another page, the tab will be the same (it is an browser view).

So it's important to keep some reference to tab objects, in case you're done interacting with elements and want to operate on the page level again.

Custom CDP commands
Tab object provide many useful and often-used methods. It is also possible to utilize the included cdp classes to to something totally custom.

the cdp package is a set of so-called "domains" with each having methods, events and types. to send a cdp method, for example cdp.page.navigate, you'll have to check whether the method accepts any parameters and whether they are required or not.

you can use

`python await tab.send(cdp.page.navigate(url='https://yoururlhere')) `

so tab.send() accepts a generator object, which is created by calling a cdp method. this way you can build very detailed and customized commands. (note: finding correct command combo's can be a time consuming task, luckily i added a whole bunch of useful methods, preferably having the same api's or lookalikes, as in selenium)

some useful, often needed and simply required methods
find() | find(text)
find and returns a single element by text match. by default returns the first element found. much more powerful is the best_match flag, although also much more expensive. when no match is found, it will retry for <timeout> seconds (default: 10), so this is also suitable to use as wait condition.

find() | find(text, best_match=True) or find(text, True)
Much more powerful (and expensive!!) than the above, is the use of the find(text, best_match=True) flag. It will still return 1 element, but when multiple matches are found, picks the one having the most similar text length. How would that help? For example, you search for "login", you'd probably want the "login" button element, and not thousands of scripts,meta,headings which happens to contain a string of "login".

when no match is found, it will retry for <timeout> seconds (default: 10), so this is also suitable to use as wait condition.

select() | select(selector)
find and returns a single element by css selector match. when no match is found, it will retry for <timeout> seconds (default: 10), so this is also suitable to use as wait condition.

select_all() | select_all(selector)
find and returns all elements by css selector match. when no match is found, it will retry for <timeout> seconds (default: 10), so this is also suitable to use as wait condition.

await Tab
calling await tab will do a lot of stuff under the hood, and ensures all references are up to date. also it allows for the script to "breathe", as it is oftentime faster than your browser or webpage. So whenever you get stuck and things crashes or element could not be found, you should probably let it "breathe" by calling await page and/or await page.sleep()

also, it's ensuring url will be updated to the most recent one, which is quite important in some other methods.

attempts to find the location of given template image in the current viewport the only real use case for this is bot-detection systems. you can find for example the location of a 'verify'-checkbox, which are hidden from dom using shadow-root's or workers.

await Tab.template_location (and await Tab.verify_cf)
attempts to find the location of given template image in the current viewport. the only real use case for this is bot-detection systems. you can find, for example the location of a 'verify'-checkbox, which are hidden from dom using shadow-root's or/or workers and cannot be controlled by normal methods.

template_image can be custom (for example your language, included is english only), but you need to create the template image yourself, which is just a cropped image of the area, see example image, where the target is exactly in the center. template_image can be custom (for example your language), but you need to create the template image yourself, where the target is exactly in the center.

example (111x71)
this includes the white space on the left, to make the box center

example template image
Using other and custom CDP commands
using the included cdp module, you can easily craft commands, which will always return an generator object. this generator object can be easily sent to the send() method.

send()
this is probably THE most important method, although you won't ever call it, unless you want to go really custom. the send method accepts a cdp command. Each of which can be found in the cdp section.

when you import * from this package, cdp will be in your namespace, and contains all domains/actions/events you can act upon.

async activate()[source]
active this target (ie: tab,window,page)

add_handler(event_type_or_domain, handler)
add a handler for given event

if event_type_or_domain is a module instead of a type, it will find all available events and add the handler.

if you want to receive event updates (network traffic are also 'events') you can add handlers for those events. handlers can be regular callback functions or async coroutine functions (and also just lamba's). for example, you want to check the network traffic:

page.add_handler(cdp.network.RequestWillBeSent, lambda event: print('network event => %s' % event.request))
the next time you make network traffic you will see your console print like crazy.

Parameters:
event_type_or_domain (Union[type, ModuleType, List[type]]) –

handler (Union[Callable, Awaitable]) –

Returns:
Return type:
attached: bool = None
async back()[source]
history back

async bring_to_front()[source]
alias to self.activate

property browser: Browser
async bypass_insecure_connection_warning()[source]
when you enter a site where the certificate is invalid you get a warning. call this function to "proceed" :return: :rtype:

async close()[source]
close the current target (ie: tab,window,page) :return: :rtype:

property closed
async connect(**kw)
opens the websocket connection. should not be called manually by users :type kw: :param kw: :return:

async disconnect()
closes the websocket connection. should not be called manually by users.

async download_file(url, filename=None)[source]
downloads file by given url.

Parameters:
url (str) – url of the file

filename (Optional[TypeVar(PathLike, bound= str | Path)]) – the name for the file. if not specified the name is composed from the url file name

async evaluate(expression, await_promise=False, return_by_value=False)[source]
Return type:
Union[str, Any, Tuple[RemoteObject, Optional[ExceptionDetails]]]

async feed_cdp(cmd)[source]
Return type:
Future

async find(text, best_match=True, return_enclosing_element=True, timeout=10)[source]
find single element by text can also be used to wait for such element to appear.

Parameters:
text (str) – text to search for. note: script contents are also considered text

best_match (bool) –

param best_match:
when True (default), it will return the element which has the most comparable string length. this could help tremendously, when for example you search for "login", you'd probably want the login button element, and not thousands of scripts,meta,headings containing a string of "login". When False, it will return naively just the first match (but is way faster).

type best_match:
bool

timeout (float,int) – raise timeout exception when after this many seconds nothing is found.

async find_all(text, timeout=10)[source]
find multiple elements by text can also be used to wait for such element to appear.

Parameters:
text (str) – text to search for. note: script contents are also considered text

timeout (float,int) – raise timeout exception when after this many seconds nothing is found.

Return type:
List[Element]

async find_element_by_text(text, best_match=False, return_enclosing_element=True)[source]
finds and returns the first element containing <text>, or best match

Parameters:
text (str) –

best_match (bool) – when True, which is MUCH more expensive (thus much slower), will find the closest match based on length. this could help tremendously, when for example you search for "login", you'd probably want the login button element, and not thousands of scripts,meta,headings containing a string of "login".

return_enclosing_element (Optional[bool]) –

Returns:
Return type:
async find_elements_by_text(text, tag_hint=None)[source]
returns element which match the given text. returns element which match the given text. please note: this may (or will) also return any other element (like inline scripts), which happen to contain that text.

Parameters:
text (str) –

tag_hint (str) – when provided, narrows down search to only elements which match given tag eg: a, div, script, span

Returns:
Return type:
async flash_point(x, y, duration=0.5, size=10)[source]
async forward()[source]
history forward

async fullscreen()[source]
minimize page/tab/window

async get(url='chrome://welcome', new_tab=False, new_window=False)[source]
top level get. utilizes the first tab to retrieve given url.

convenience function known from selenium. this function handles waits/sleeps and detects when DOM events fired, so it's the safest way of navigating.

Parameters:
url – the url to navigate to

new_tab (bool) – open new tab

new_window (bool) – open new window

Returns:
Page

async get_all_linked_sources()[source]
get all elements of tag: link, a, img, scripts meta, video, audio

Return type:
List[Element]

Returns:
async get_all_urls(absolute=True)[source]
convenience function, which returns all links (a,link,img,script,meta)

Parameters:
absolute – try to build all the links in absolute form instead of "as is", often relative

Return type:
List[str]

Returns:
list of urls

async get_content()[source]
gets the current page source content (html) :return: :rtype:

async get_frame_resource_tree()[source]
retrieves the frame resource tree for current tab. There seems no real difference between Tab.get_frame_tree() but still it returns a different object :return: :rtype:

async get_frame_resource_urls()[source]
gets the urls of resources :return: :rtype:

async get_frame_tree()[source]
retrieves the frame tree for current tab There seems no real difference between Tab.get_frame_resource_tree() :return: :rtype:

async get_local_storage()[source]
get local storage items as dict of strings (careful!, proper deserialization needs to be done if needed)

Returns:
Return type:
async get_window()[source]
get the window Bounds :return: :rtype:

inspector_open()[source]
property inspector_url
get the inspector url. this url can be used in another browser to show you the devtools interface for current tab. useful for debugging (and headless) :return: :rtype:

async js_dumps(obj_name, return_by_value=True)[source]
dump given js object with its properties and values as a dict

note: complex objects might not be serializable, therefore this method is not a "source of thruth"

Parameters:
obj_name (str) – the js object to dump

return_by_value (bool) – if you want an tuple of cdp objects (returnvalue, errors), set this to False

Return type:
Union[Dict, Tuple[RemoteObject, ExceptionDetails]]

Example

x = await self.js_dumps('window') print(x)

'...{ 'pageYOffset': 0, 'visualViewport': {}, 'screenX': 10, 'screenY': 10, 'outerWidth': 1050, 'outerHeight': 832, 'devicePixelRatio': 1, 'screenLeft': 10, 'screenTop': 10, 'styleMedia': {}, 'onsearch': None, 'isSecureContext': True, 'trustedTypes': {}, 'performance': {'timeOrigin': 1707823094767.9, 'timing': {'connectStart': 0, 'navigationStart': 1707823094768, ]...'

async maximize()[source]
maximize page/tab/window

async medimize()[source]
async minimize()[source]
minimize page/tab/window

async mouse_click(x, y, button='left', buttons=1, modifiers=0, _until_event=None)[source]
native click on position x,y :type y: float :param y: :type y: :type x: float :param x: :type x: :type button: str :param button: str (default = "left") :type buttons: Optional[int] :param buttons: which button (default 1 = left) :type modifiers: Optional[int] :param modifiers: (Optional) Bit field representing pressed modifier keys.

Alt=1, Ctrl=2, Meta/Command=4, Shift=8 (default: 0).

Parameters:
_until_event (Optional[type]) – internal. event to wait for before returning

Returns:
async mouse_drag(source_point, dest_point, relative=False, steps=1)[source]
drag mouse from one point to another. holding button pressed you are probably looking for element.Element.mouse_drag() method. where you can drag on the element

Parameters:
dest_point (tuple[float, float]) –

source_point (tuple[float, float]) –

relative (bool) – when True, treats point as relative. for example (-100, 200) will move left 100px and down 200px

steps (int) – move in <steps> points, this could make it look more "natural" (default 1), but also a lot slower. for very smooth action use 50-100

Returns:
Return type:
async mouse_move(x, y, steps=10, flash=False)[source]
async open_external_inspector()[source]
opens the system's browser containing the devtools inspector page for this tab. could be handy, especially to debug in headless mode.

async query_selector(selector, _node=None)[source]
find single element based on css selector string

Parameters:
selector (str) – css selector(s)

Returns:
Return type:
async query_selector_all(selector, _node=None)[source]
equivalent of javascripts document.querySelectorAll. this is considered one of the main methods to use in this package.

it returns all matching nodriver.Element objects.

Parameters:
selector (str) – css selector. (first time? => https://www.w3schools.com/cssref/css_selectors.php )

_node (Union[Node, Element, None]) – internal use

Returns:
Return type:
async reload(ignore_cache=True, script_to_evaluate_on_load=None)[source]
Reloads the page

Parameters:
ignore_cache (Optional[bool]) – when set to True (default), it ignores cache, and re-downloads the items

script_to_evaluate_on_load (Optional[str]) – script to run on load. I actually haven't experimented with this one, so no guarantees.

Returns:
Return type:
remove_handler(event_type_or_domain, handler=None)
remove a handler for given event :type event_type_or_domain: Union[type, ModuleType, List[type]] :param event_type_or_domain: :type event_type_or_domain: :type handler: Union[Callable, Awaitable] :param handler: :type handler:

async save_screenshot(filename='auto', format='jpeg', full_page=False)[source]
Saves a screenshot of the page. This is not the same as Element.save_screenshot, which saves a screenshot of a single element only

Parameters:
filename (PathLike) – uses this as the save path

format (str) – jpeg or png (defaults to jpeg)

full_page (bool) – when False (default) it captures the current viewport. when True, it captures the entire page

Returns:
the path/filename of saved screenshot

Return type:
str

async scroll_bottom_reached()[source]
returns True if scroll is at the bottom of the page handy when you need to scroll over paginated pages of different lengths :return: :rtype:

async scroll_down(amount=25)[source]
scrolls down maybe

Parameters:
amount (int) – number in percentage. 25 is a quarter of page, 50 half, and 1000 is 10x the page

Returns:
Return type:
async scroll_up(amount=25)[source]
scrolls up maybe

Parameters:
amount (int) – number in percentage. 25 is a quarter of page, 50 half, and 1000 is 10x the page

Returns:
Return type:
async search_frame_resources(query)[source]
Return type:
Dict[str, List[SearchMatch]]

async select(selector, timeout=10)[source]
find single element by css selector. can also be used to wait for such element to appear.

Parameters:
selector (str) – css selector, eg a[href], button[class*=close], a > img[src]

timeout (float,int) – raise timeout exception when after this many seconds nothing is found.

Return type:
Element

async select_all(selector, timeout=10, include_frames=False)[source]
find multiple elements by css selector. can also be used to wait for such element to appear.

Parameters:
selector (str) – css selector, eg a[href], button[class*=close], a > img[src]

timeout (float,int) – raise timeout exception when after this many seconds nothing is found.

include_frames (bool) – whether to include results in iframes.

Return type:
List[Element]

async send(cdp_obj, _is_update=False)
send a protocol command. the commands are made using any of the cdp.<domain>.<method>()'s and is used to send custom cdp commands as well.

Parameters:
cdp_obj (Generator[dict[str, Any], dict[str, Any], Any]) – the generator object created by a cdp method

_is_update – internal flag prevents infinite loop by skipping the registeration of handlers when multiple calls to connection.send() are made

Return type:
Any

Returns:
async set_download_path(path)[source]
sets the download path and allows downloads this is required for any download function to work (well not entirely, since when unset we set a default folder)

Parameters:
path (Union[str, TypeVar(PathLike, bound= str | Path)]) –

Returns:
Return type:
async set_local_storage(items)[source]
set local storage. dict items must be strings. simple types will be converted to strings automatically.

Parameters:
items (dict[str,str]) – dict containing {key:str, value:str}

Returns:
Return type:
async set_window_size(left=0, top=0, width=1280, height=1024)[source]
set window size and position

Parameters:
left – pixels from the left of the screen to the window top-left corner

top – pixels from the top of the screen to the window top-left corner

width – width of the window in pixels

height – height of the window in pixels

Returns:
Return type:
async set_window_state(left=0, top=0, width=1280, height=720, state='normal')[source]
sets the window size or state.

for state you can provide the full name like minimized, maximized, normal, fullscreen, or something which leads to either of those, like min, mini, mi, max, ma, maxi, full, fu, no, nor in case state is set other than "normal", the left, top, width, and height are ignored.

Parameters:
left (int) – desired offset from left, in pixels

top (int) – desired offset from the top, in pixels

width (int) – desired width in pixels

height (int) – desired height in pixels

state (str) –

can be one of the following strings:
normal

fullscreen

maximized

minimized

async sleep(t=1)[source]
property target: TargetInfo
async template_location(template_image=None)[source]
attempts to find the location of given template image in the current viewport the only real use case for this is bot-detection systems. you can find for example the location of a 'verify'-checkbox, which are hidden from dom using shadow-root's or workers.

template_image can be custom (for example your language, included is english only), but you need to create the template image yourself, which is just a cropped image of the area, see example image, where the target is exactly in the center. template_image can be custom (for example your language), but you need to create the template image yourself, where the target is exactly in the center.

example (111x71)
this includes the white space on the left, to make the box center

example template image
type template_image:
TypeVar(PathLike, bound= str | Path)

param template_image:
type template_image:
return:
rtype:
async verify_cf(template_image=None, flash=False)[source]
convenience function to verify cf checkbox

template_image can be custom (for example your language, included is english only), but you need to create the template image yourself, which is just a cropped image of the area, see example image, where the target is exactly in the center.

example (111x71)
this includes the white space on the left, to make the box center

example template image
type template_image:
str

param template_image:
template_image can be custom (for example your language, included is english only), but you need to create the template image yourself, which is just a cropped image of the area, where the target is exactly in the center. see example on (https://ultrafunkamsterdam.github.io/nodriver/nodriver/classes/tab.html#example-111x71),

type template_image:
type flash:
param flash:
whether to show an indicator where the mouse is clicking.

type flash:
return:
rtype:
async wait(t=None)[source]
async wait_for(selector='', text='', timeout=10)[source]
variant on query_selector_all and find_elements_by_text this variant takes either selector or text, and will block until the requested element(s) are found.

it will block for a maximum of <timeout> seconds, after which an TimeoutError will be raised

Parameters:
selector (Optional[str]) – css selector

text (Optional[str]) – text

timeout (Union[int, float, None]) –

Returns:
Return type:
Element

Raises:
asyncio.TimeoutError

property websocket: ClientConnection
async xpath(xpath, timeout=2.5)[source]
find elements by xpath string. if not immediately found, retries are attempted until timeout is reached (default 2.5 seconds). in case nothing is found, it returns an empty list. It will not raise. this timeout mechanism helps when relying on some element to appear before continuing your script.

# find all the inline scripts (script elements without src attribute )
await tab.xpath('//script[not(@src)]')

# or here, more complex, but my personal favorite to case-insensitive text search

await tab.xpath('//text()[ contains( translate(., "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "abcdefghijklmnopqrstuvwxyz"),"test")]')
Parameters:
xpath (str) –

timeout (float) – 2.5

:return:List[nodriver.Element] or [] :rtype:


Browser class
cookies
You can load and save all cookies from the browser.

# save. when no filepath is given, it is saved in '.session.dat'
await browser.cookies.save()
# load. when no filepath is given, it is loaded from '.session.dat'
await browser.cookies.load()
# export for requests or other library
requests_style_cookies = await browser.cookies.get_all(requests_cookie_format=True)

# use in requests:
session = requests.Session()
for cookie in requests_style_cookies:
    session.cookies.set_cookie(cookie)
Browser class
class Browser(config, **kwargs)[source]
The Browser object is the "root" of the hierarchy and contains a reference to the browser parent process. there should usually be only 1 instance of this.

All opened tabs, extra browser screens and resources will not cause a new Browser process, but rather create additional nodriver.Tab objects.

So, besides starting your instance and first/additional tabs, you don't actively use it a lot under normal conditions.

Tab objects will represent and control
tabs (as you know them)

browser windows (new window)

iframe

background processes

note: the Browser object is not instantiated by __init__ but using the asynchronous nodriver.Browser.create() method.

note: in Chromium based browsers, there is a parent process which keeps running all the time, even if there are no visible browser windows. sometimes it's stubborn to close it, so make sure after using this library, the browser is correctly and fully closed/exited/killed.

async classmethod create(config=None, *, user_data_dir=None, headless=False, browser_executable_path=None, browser_args=None, sandbox=True, host=None, port=None, **kwargs)[source]
entry point for creating an instance

Return type:
Browser

config: Config
targets: List
current targets (all types

connection: Connection
property websocket_url
property main_tab: Tab
returns the target which was launched with the browser

property tabs: List[Tab]
returns the current targets which are of type "page" :return:

property cookies: CookieJar
property stopped
async wait(time=0.1)[source]
wait for <time> seconds. important to use, especially in between page navigation

Parameters:
time (Union[float, int]) –

Returns:
async sleep(time=0.1)
alias for wait

async get(url='chrome://welcome', new_tab=False, new_window=False)[source]
top level get. utilizes the first tab to retrieve given url.

convenience function known from selenium. this function handles waits/sleeps and detects when DOM events fired, so it's the safest way of navigating.

Parameters:
url – the url to navigate to

new_tab (bool) – open new tab

new_window (bool) – open new window

Return type:
Tab

Returns:
Page

async create_context(url='chrome://welcome', new_tab=False, new_window=True, dispose_on_detach=True, proxy_server=None, proxy_bypass_list=None, origins_with_universal_network_access=None)[source]
creates a new browser context - mostly useful if you want to use proxies for different browser instances since chrome usually can only use 1 proxy per browser. socks5 with authentication is supported by using a forwarder proxy, the correct string to use socks proxy with username/password auth is socks://USERNAME:PASSWORD@SERVER:PORT

dispose_on_detach – (EXPERIMENTAL) (Optional) If specified, disposes this context when debugging session disconnects. proxy_server – (EXPERIMENTAL) (Optional) Proxy server, similar to the one passed to –proxy-server proxy_bypass_list – (EXPERIMENTAL) (Optional) Proxy bypass list, similar to the one passed to –proxy-bypass-list origins_with_universal_network_access – (EXPERIMENTAL) (Optional) An optional list of origins to grant unlimited cross-origin access to. Parts of the URL other than those constituting origin are ignored.

Parameters:
new_window (bool) –

new_tab (bool) –

url (str) –

dispose_on_detach (bool) –

proxy_server (str) –

proxy_bypass_list (List[str]) –

origins_with_universal_network_access (List[str]) –

Returns:
Return type:
async start()[source]
launches the actual browser

Return type:
Browser

async grant_all_permissions()[source]
grant permissions for:
accessibilityEvents audioCapture backgroundSync backgroundFetch clipboardReadWrite clipboardSanitizedWrite displayCapture durableStorage geolocation idleDetection localFonts midi midiSysex nfc notifications paymentHandler periodicBackgroundSync protectedMediaIdentifier sensors storageAccess topLevelStorageAccess videoCapture videoCapturePanTiltZoom wakeLockScreen wakeLockSystem windowManagement

async tile_windows(windows=None, max_columns=0)[source]
async update_targets()[source]
stop()[source]


Element class
Some words about the Element class

class Element(node, tab, tree=None)[source]
property tag
property tag_name
property node_id
property backend_node_id
property node_type
property node_name
property local_name
property node_value
property parent_id
property child_node_count
property attributes
property document_url
property base_url
property public_id
property system_id
property internal_subset
property xml_version
property value
property pseudo_type
property pseudo_identifier
property shadow_root_type
property frame_id
property content_document
property shadow_roots
property template_content
property pseudo_elements
property imported_document
property distributed_nodes
property is_svg
property compatibility_mode
property assigned_slot
property tab
property shadow_children
async save_to_dom()[source]
saves element to dom :return: :rtype:

async remove_from_dom()[source]
removes the element from dom

async update(_node=None)[source]
updates element to retrieve more properties. for example this enables children and parent attributes.

also resolves js opbject which is stored object in remote_object

usually you will get element nodes by the usage of

Tab.query_selector_all()

Tab.find_elements_by_text()

those elements are already updated and you can browse through children directly.

The reason for a seperate call instead of doing it at initialization, is because when you are retrieving 100+ elements this becomes quite expensive.

therefore, it is not advised to call this method on a bunch of blocks (100+) at the same time.

Returns:
Return type:
property node
property tree: Node
property attrs
attributes are stored here, however, you can set them directly on the element object as well. :return: :rtype:

property parent: Element | None
get the parent element (node) of current element(node) :return: :rtype:

property children: List[Element] | str
returns the elements' children. those children also have a children property so you can browse through the entire tree as well. :return: :rtype:

property remote_object: RemoteObject
property object_id: RemoteObjectId
async click()[source]
Click the element.

Returns:
Return type:
async get_js_attributes()[source]
async apply(js_function, return_by_value=True)[source]
apply javascript to this element. the given js_function string should accept the js element as parameter, and can be a arrow function, or function declaration. eg:

'(elem) => { elem.value = "blabla"; consolelog(elem); alert(JSON.stringify(elem); } '

'elem => elem.play()'

function myFunction(elem) { alert(elem) }

Parameters:
js_function (str) – the js function definition which received this element.

return_by_value –

Returns:
Return type:
async get_position(abs=False)[source]
Return type:
Position

async mouse_click(button='left', buttons=1, modifiers=0, _until_event=None)[source]
native click (on element) . note: this likely does not work atm, use click() instead

Parameters:
button (str) – str (default = "left")

buttons (Optional[int]) – which button (default 1 = left)

modifiers (Optional[int]) – (Optional) Bit field representing pressed modifier keys. Alt=1, Ctrl=2, Meta/Command=4, Shift=8 (default: 0).

_until_event (Optional[type]) – internal. event to wait for before returning

Returns:
async click_mouse(button='left', buttons=1, modifiers=0, _until_event=None)
native click (on element) . note: this likely does not work atm, use click() instead

Parameters:
button (str) – str (default = "left")

buttons (Optional[int]) – which button (default 1 = left)

modifiers (Optional[int]) – (Optional) Bit field representing pressed modifier keys. Alt=1, Ctrl=2, Meta/Command=4, Shift=8 (default: 0).

_until_event (Optional[type]) – internal. event to wait for before returning

Returns:
async mouse_move()[source]
moves mouse (not click), to element position. when an element has an hover/mouseover effect, this would trigger it

async mouse_drag(destination, relative=False, steps=1)[source]
drag an element to another element or target coordinates. dragging of elements should be supported by the site of course

Parameters:
destination (Element or coordinate as x,y tuple) – another element where to drag to, or a tuple (x,y) of ints representing coordinate

relative (bool) – when True, treats coordinate as relative. for example (-100, 200) will move left 100px and down 200px

steps (int) – move in <steps> points, this could make it look more "natural" (default 1), but also a lot slower. for very smooth action use 50-100

Returns:
Return type:
async scroll_into_view()[source]
scrolls element into view

async clear_input(_until_event=None)[source]
clears an input field

async send_keys(text)[source]
send text to an input field, or any other html element.

hint, if you ever get stuck where using py:meth:~click does not work, sending the keystroke n or rn or a spacebar work wonders!

Parameters:
text (str) – text to send

Returns:
None

async send_file(*file_paths)[source]
some form input require a file (upload), a full path needs to be provided. this method sends 1 or more file(s) to the input field.

needles to say, but make sure the field accepts multiple files if you want to send more files. otherwise the browser might crash.

example : await fileinputElement.send_file('c:/temp/image.png', 'c:/users/myuser/lol.gif')

async focus()[source]
focus the current element. often useful in form (select) fields

async select_option()[source]
for form (select) fields. when you have queried the options you can call this method on the option object. 02/08/2024: fixed the problem where events are not fired when programattically selecting an option.

calling option.select_option() will use that option as selected value. does not work in all cases.

async set_value(value)[source]
async set_text(value)[source]
async get_html()[source]
property text: str
gets the text contents of this element note: this includes text in the form of script content, as those are also just 'text nodes'

Returns:
Return type:
property text_all
gets the text contents of this element, and it's children in a concatenated string note: this includes text in the form of script content, as those are also just 'text nodes' :return: :rtype:

async query_selector_all(selector)[source]
like js querySelectorAll()

async query_selector(selector)[source]
like js querySelector()

async save_screenshot(filename='auto', format='jpeg', scale=1)[source]
Saves a screenshot of this element (only) This is not the same as Tab.save_screenshot, which saves a "regular" screenshot

When the element is hidden, or has no size, or is otherwise not capturable, a RuntimeError is raised

Parameters:
filename (PathLike) – uses this as the save path

format (str) – jpeg or png (defaults to jpeg)

scale (Union[int, float, None]) – the scale of the screenshot, eg: 1 = size as is, 2 = double, 0.5 is half

Returns:
the path/filename of saved screenshot

Return type:
str

async flash(duration=0.5)[source]
displays for a short time a red dot on the element (only if the element itself is visible)

Parameters:
coords (x,y) – x,y

duration (Union[float, int]) – seconds (default 0.5)

Returns:
Return type:
async highlight_overlay()[source]
highlights the element devtools-style. To remove the highlight, call the method again. :return: :rtype:

async record_video(filename=None, folder=None, duration=None)[source]
experimental option.

Parameters:
filename (Optional[str]) – the desired filename

folder (Optional[str]) – the download folder path

duration (Union[int, float, None]) – record for this many seconds and then download

on html5 video nodes, you can call this method to start recording of the video.

when any of the follow happens:

video ends

calling videoelement('pause')

video stops

the video recorded will be downloaded.

async is_recording()[source]
