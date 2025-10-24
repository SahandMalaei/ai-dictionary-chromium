# AI Dictionary: Instant Dictionary for Google Chrome and Microsoft Edge

AI Dictionary is a plugin for Google Chrome and Microsoft Edge that can have a transformative effect on your reading and language learning. I originally built it for my personal use, out of frustration with exisiting dictionaries. These are the benefits of this plugin over more traditional dictionaries:
1. This plugin gives you the definition of the selected word(s) **in the context** of its surrounding words. Traditional dictionaries show you several definitions of the word(s), and you have to decide which one is right for the context.
2. Allows you to select multiple words, phrasal verbs, and idioms. That's something traditional dictionaries struggle with.
3. Can give you the definition of technical terms and even fictional words, since it has access to basically all the information available online.
4. It's very simple to use. Select the word(s), right click and select "Define Selection". That's it. It's the most seamless and instant dictionary solution I have seen.

![Demo](demo.gif)

## How to Use

To use this plugin, You'll need to do a few things:

1. Grab the [latest release of this plugin](https://github.com/SahandMalaei/ai-dictionary-chromium/releases/latest), and unpack the zip file somewhere.
2. Go to your browser's extenstions page. In Google Chrome that's "chrome://extensions". In Edge, that's "edge://extensions". Enable "Developer Mode". Select "Load Unpacked", and point to the folder of the downloaded plugin. The plugin is now installed.
3. Acquire an API key from [Google AI Studio](https://aistudio.google.com/api-keys). The free tier will most probably suffice for personal use.
4. Select some word(s)/text, right click, and choose "Define Selection". You can also press the combination "Ctrl + Shift + L" to achieve the same thing. As this is your first time calling the dictionary, a dialog will open asking you to enter your API key. Enter the API key you acquired in the previous step, and you are all set!

## What's Next?

I'm calling on you—the community—to help expand this plugin with features that might help others read/study/learn better. A few starters:
1. Add a nice log file of every word/selection the user has looked up so far
2. The plugin is built around English-to-English dictionary lookups, though supporting other languages in the future might make sense. Making it seamless is the main challenge.

License: GPLv3