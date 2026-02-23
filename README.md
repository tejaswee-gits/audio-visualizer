# Sonic Canvas - Professional Audio/Video Visualizer

<div align="center">
  <img alt="Project Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" width="800" />
</div>

## 🌟 Overview

Sonic Canvas is a sleek, web-based Audio and Video Visualizer application built for modern content creators. Whether you're producing podcast snippets, music release teasers, lyrical karaoke tracks, or TikTok/Instagram Reels, this tool allows you to sync beautiful, dynamic visualizers directly over your own audio and video files. 

The application works entirely within your browser to generate responsive, high frame-rate visual overlays that react perfectly to the sound frequencies in your media.

## 🚀 Key Features

- **Dual Media Support (Audio & Video)**: Upload any `.mp3`, `.wav`, or even `.mp4`/`.webm` video files. The tool intelligently parses the media's audio track and allows you to render visualizers directly on top of your video layer.
- **Smart Aspect Ratios**: Automatically switch to 9:16 Portrait mode (perfect for TikToks and Reels) when a video file is detected, alongside standard 16:9 and Auto modes.
- **AI-Powered Lyric Transcription**: Harnesses the Google Gemini API to automatically transcribe lyrics with exquisite timing. Generates synchronized, karaoke-style lyrics that highlight in perfect sync with the playback.
- **Four Distinct Visualizer Types**:
  - **Circle**: A pulsating, spectral ring wrapping around the center.
  - **Wave**: A smooth, neon-lit frequency wave at the bottom of the screen.
  - **MIDI Roll**: A descending, cascading note map imitating a digital piano roll.
  - **Karaoke Lyrics**: Highly dynamic, bouncing text with real-time fill effects.
- **Background Dimming Control**: Gives you granular control over the darkness overlay placed on top of your background image/video.
- **High-Quality Export**: Record and export your creation directly from the browser locally at crisp 60FPS using the `vp9` codec, ensuring maximum quality for social platforms.

## 💼 Endless Use Cases

1. **Social Media Reels / TikToks**: Drop a video of yourself talking or performing, add the "Wave" overlay to visualize your voice, and export it instantly for engagement.
2. **Lyric & Music Videos**: Upload an instrumental beat or a complete track. Pair it with a custom background image and AI-transcribed lyrics to generate a production-ready lyrical music video.
3. **Podcast Teasers**: Use the `9:16` dimension to create engaging, short-form clips of a podcast episode snippet with a reactive audio ring around the hosts' faces.

## 🛠️ Run Locally

This application is built using React, Vite, and HTML5 Canvas. To run it locally and test its features:

**Prerequisites:** Node.js v18+ 

1. **Clone the repository:**
   ```bash
   git clone https://github.com/tejaswee-gits/audio-visualizer.git
   cd audio-visualizer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env.local` file in the root directory and add your Google Gemini API key to enable AI transcription.
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

Navigate to `http://localhost:3000` or the port specified in your console to view the app!

---
*Developed with a focus on premium, dynamic interface design and seamless visual sync.*
