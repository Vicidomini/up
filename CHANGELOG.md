# Changelog

## [Unreleased] - 2023-09-14

- Modified focus to only if content was pasted
- Updated logic for youtube replay 

## [Unreleased] - 2023-09-14

- Redid multi-click handling
    * restores default triple-click select text
- New Section: Updates (under support)

## [Unreleased] - 2023-09-13

- Swapped double click -> click
- Now focuses on target upon paste
- New Section: Manual (under settings)
- New Setting: Filter limiter
- Updated dedupper

## [Unreleased] - 2023-09-12

- Fixed message handling on detach
    * removed listener from popup before detach
    * popup was responding before it closed
- Deduped the fetched chat responses
- Now filters chat replay
- Swapped css to dark mode

## [Unreleased] - 2023-09-11

- Added CHANGELOG.md
- Redid the port logic
    * isolates frame data in multi-frame instances
    * better tab to detached popup communication
- Counter now only applies to bucket sort

## [Unreleased] - 2023-09-10

- New Feature: Detachable Popup
    * pressing the logo now detaches the popup

## [Unreleased]

- New Feature: Up
    * youtube.com: key up retrieves previous input
    * twitch.tv: key up retrieves previous input
    * openai.com: key up retrieves previous input
- New Feature: Popup
    * actions
        + long press: save or unsave
        + double click: add text to input field
    * page1: home
        + displays saved and new user input
    * page2: settings
    * page3: filter (youtube.com only)
        + sorted by the latest of the most commented
    * page4: contact 
    * page5: lifeline
