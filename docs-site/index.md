---
layout: landing
sidebar: false
aside: false
title: Social Explorer
titleTemplate: Open-source social media analytics and investigation
head:
  - - meta
    - property: og:title
      content: 'Social Explorer: follow a story across social, news and radio'
  - - meta
    - property: og:description
      content: Open-source platform that brings posts, news events and broadcasts into one database and scores them for sentiment, topics and language. Try it with one command.

# Note: the landing page (theme/Landing.vue) renders hero.text and hero.tagline, and the first three
# features as its steps. hero.actions is not rendered there (its buttons are fixed in the component);
# it feeds only the generated wiki Home (scripts/wiki.mjs), so keep it in step with the buttons.
hero:
  name: Social Explorer
  text: Follow a story across social, news and radio
  tagline: Social Explorer brings posts, news events and broadcasts into one database, scores them for sentiment, topics and language, and gives you a workbench to find out what is driving the conversation.
  actions:
    - theme: brand
      text: Try the demo
      link: /guide/demo-data
    - theme: alt
      text: Read the docs
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/spiculedata/social-explorer

features:
  - title: Collect
    details: Bring posts in from Telegram, YouTube and Bluesky, pull GDELT news events, load your own datasets and capture radio with transcription.
  - title: Analyse
    details: Sentiment, emotion, topics and language for every post, with engagement, hashtag and phrase analysis on top.
  - title: Investigate
    details: Group work into projects and workspaces, then follow a keyword across social, news and radio on one timeline.
  - title: Research
    details: Built-in Jupyter notebooks, plus a visual workflow builder (early preview).
  - title: Share
    details: Give a collaborator, a reviewer or a journal one content ID for the dataset behind your findings, and anyone with it can fetch the same package. It travels as an open Frictionless Data Package (a plain CSV plus a schema) that opens in Python, R or Excel, and the ID always resolves to the same bytes, so a paper can cite exactly the version published and any change gives a new ID. Opt-in and admin-only, because what you publish to the IPFS network is public for good, and it stays reachable only while a node holds a copy.
    link: /guide/data-sharing
    linkText: How sharing works
---
