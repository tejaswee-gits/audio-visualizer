import React, { useState, useRef, useEffect } from 'react';
import { Upload, Play, Pause, Square, Music, Download, Settings, X, ChevronDown, Image as ImageIcon, Monitor, Smartphone, FileText } from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";
import Visualizer, { LyricLine, ElementConfig } from './components/Visualizer';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [circleConfig, setCircleConfig] = useState<ElementConfig>({ show: false, x: 0.5, y: 0.5 });
  const [heartbeatConfig, setHeartbeatConfig] = useState<ElementConfig>({ show: true, x: 0.5, y: 0.5 });
  const [waveConfig, setWaveConfig] = useState<ElementConfig>({ show: false, x: 0.5, y: 0.85 });
  const [subtleWaveConfig, setSubtleWaveConfig] = useState<ElementConfig>({ show: true, x: 0.5, y: 0.45 });
  const [midiConfig, setMidiConfig] = useState<ElementConfig>({ show: false, x: 0.5, y: 0.5 });
  const [lyricsConfig, setLyricsConfig] = useState<ElementConfig>({ show: true, x: 0.5, y: 0.5, karaoke: true, showNext: true });
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null);
  const [aspectRatio, setAspectRatio] = useState<'auto' | '16:9' | '9:16'>('auto');
  const [recordingMode, setRecordingMode] = useState<'current' | 'circle' | 'heartbeat' | 'wave' | 'subtleWave' | 'midi' | 'lyrics' | null>(null);
  const [autoTranscribe, setAutoTranscribe] = useState(true);
  const [isVideoMode, setIsVideoMode] = useState(false);
  const [backgroundDim, setBackgroundDim] = useState(0.75);

  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [referenceLyrics, setReferenceLyrics] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedTime, setTranscribedTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const audioRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAudioFile(file);
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      setFileName(file.name);

      if (file.type.startsWith('video/')) {
        setIsVideoMode(true);
        setAspectRatio('9:16');
      } else {
        setIsVideoMode(false);
      }
      setIsPlaying(false);
      setLyrics([]);
      setCurrentTime(0);
      setDuration(0);
      setTranscribedTime(0);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
      }
      if (autoTranscribe) {
        transcribeAudio(file, referenceLyrics);
      }
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        let text = reader.result as string;
        try {
          const json = JSON.parse(text);
          text = JSON.stringify(json, null, 2);
        } catch (err) { }
        setReferenceLyrics(text);

        if (audioFile) {
          transcribeAudio(audioFile, text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => setBackgroundImage(img);
      img.src = url;
    }
  };

  const transcribeAudio = async (file: File, refText: string | null) => {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("No Gemini API key found. Skipping transcription.");
      return;
    }

    setIsTranscribing(true);
    setTranscribedTime(0);
    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
      });

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      let promptText = "Transcribe the lyrics of this song with EXTREME timing accuracy. Return the result as a JSON array of objects, where each object has 'startTime' (in seconds, float), 'endTime' (in seconds, float), 'text' (the lyric phrase), and 'words' (an array of objects with 'word', 'startTime', and 'endTime'). \n\nCRITICAL INSTRUCTIONS:\n1. Break the lyrics down into VERY SHORT phrases (2-4 words maximum). This is required for the karaoke effect to sync properly.\n2. The startTime and endTime MUST exactly match the exact millisecond the singer starts and stops singing those specific words.\n3. Provide word-level timestamps in the 'words' array for perfect karaoke sync. The words array should contain each word in the phrase with its exact start and end time.\n4. Do NOT stretch the endTime to meet the next line. If there is a pause in singing, there should be a gap between the endTime of the current phrase and the startTime of the next.\n5. Pay close attention to the ENTIRE audio track from start to finish. Do not lose track of the time. The timestamps must be absolute seconds from the beginning of the audio file.\n6. If there are no lyrics, return an empty array.\nOutput the array item by item.";

      if (refText) {
        promptText += `\n\nHere are the reference lyrics to help you with accuracy (they do not have timings):\n${refText}\n\nPlease use these as a reference for the words, but you MUST still break them into 2-4 word phrases and provide the EXACT timing for each short phrase.`;
      }

      const responseStream = await ai.models.generateContentStream({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type || 'audio/mp3',
                data: base64Data
              }
            },
            {
              text: promptText
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                startTime: { type: Type.NUMBER },
                endTime: { type: Type.NUMBER },
                text: { type: Type.STRING },
                words: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      startTime: { type: Type.NUMBER },
                      endTime: { type: Type.NUMBER }
                    },
                    required: ["word", "startTime", "endTime"]
                  }
                }
              },
              required: ["startTime", "endTime", "text"]
            }
          }
        }
      });

      let accumulatedText = "";
      for await (const chunk of responseStream) {
        accumulatedText += chunk.text;

        let parsedLyrics: LyricLine[] = [];
        let braceCount = 0;
        let objStart = -1;
        let inString = false;
        let escapeNext = false;

        for (let i = 0; i < accumulatedText.length; i++) {
          const char = accumulatedText[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\') {
            escapeNext = true;
            continue;
          }

          if (char === '"') {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              if (braceCount === 0) objStart = i;
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && objStart !== -1) {
                try {
                  const obj = JSON.parse(accumulatedText.substring(objStart, i + 1));
                  if (obj.startTime !== undefined && obj.endTime !== undefined && obj.text) {
                    parsedLyrics.push(obj);
                  }
                } catch (e) { }
                objStart = -1;
              }
            }
          }
        }

        if (parsedLyrics.length > 0) {
          setLyrics(parsedLyrics);
          setTranscribedTime(parsedLyrics[parsedLyrics.length - 1].endTime);
        }
      }
    } catch (error) {
      console.error("Transcription failed:", error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 2048;

      if (audioRef.current) {
        sourceRef.current = audioCtxRef.current.createMediaElementSource(audioRef.current);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioCtxRef.current.destination);
      }
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const togglePlay = () => {
    if (!audioUrl || !audioRef.current) return;

    initAudio();

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const stopAudio = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setIsPlaying(false);
  };

  const startRecording = (mode: 'current' | 'circle' | 'heartbeat' | 'wave' | 'subtleWave' | 'midi' | 'lyrics') => {
    if (!audioCtxRef.current || !canvasRef.current || !audioRef.current) return;

    setRecordingMode(mode);
    setShowDownloadMenu(false);

    // Small delay to allow React to apply the recordingMode configs
    setTimeout(() => {
      const canvasStream = canvasRef.current!.captureStream(60);
      const dest = audioCtxRef.current!.createMediaStreamDestination();
      analyserRef.current?.connect(dest);

      const tracks = [
        ...canvasStream.getVideoTracks(),
        ...dest.stream.getAudioTracks()
      ];
      const combinedStream = new MediaStream(tracks);

      const options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 8000000 };
      let recorder: MediaRecorder;
      try {
        recorder = new MediaRecorder(combinedStream, options);
      } catch (e) {
        recorder = new MediaRecorder(combinedStream);
      }

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName ? fileName.split('.')[0] : 'visualizer'}_${mode}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        setIsRecording(false);
        setRecordingMode(null);
      };

      recorder.start();
      setIsRecording(true);

      audioRef.current!.currentTime = 0;
      audioRef.current!.play();
      setIsPlaying(true);
    }, 100);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadSRT = () => {
    if (lyrics.length === 0) return;

    const formatTime = (seconds: number) => {
      const date = new Date(Math.max(0, seconds * 1000));
      const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
      const mm = String(date.getUTCMinutes()).padStart(2, '0');
      const ss = String(date.getUTCSeconds()).padStart(2, '0');
      const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
      return `${hh}:${mm}:${ss},${ms}`;
    };

    const srtContent = lyrics.map((line, index) => {
      return `${index + 1}\n${formatTime(line.startTime)} --> ${formatTime(line.endTime)}\n${line.text}\n`;
    }).join('\n');

    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName ? fileName.split('.')[0] : 'lyrics'}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onEnded = () => {
      setIsPlaying(false);
      if (isRecording) {
        stopRecording();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [isRecording]);

  useEffect(() => {
    let animationFrameId: number;

    const updateTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime);
      }
      animationFrameId = requestAnimationFrame(updateTime);
    };

    if (isPlaying) {
      updateTime();
    } else if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const newTime = pos * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentLineIndex = lyrics.findIndex((line, index) => {
    const nextLine = lyrics[index + 1];
    if (nextLine) {
      return currentTime >= line.startTime && currentTime < nextLine.startTime;
    }
    return currentTime >= line.startTime;
  });

  const getEffectiveConfig = (type: 'circle' | 'heartbeat' | 'wave' | 'subtleWave' | 'midi' | 'lyrics', config: ElementConfig) => {
    if (!recordingMode || recordingMode === 'current') return config;
    return { ...config, show: recordingMode === type };
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto p-6 flex flex-col h-screen">
        <header className="py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Music className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Audio Visualizer</h1>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-indigo-500 text-white' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 relative rounded-3xl overflow-hidden border border-zinc-800 bg-zinc-900/50 flex flex-col items-center justify-center p-4">
          {!audioUrl ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500">
              <div className="w-20 h-20 rounded-full bg-zinc-800/50 flex items-center justify-center mb-6">
                <Upload className="w-8 h-8 text-zinc-400" />
              </div>
              <h2 className="text-xl font-medium text-zinc-300 mb-2">Upload Audio or Video File</h2>
              <p className="text-sm mb-6">Select an audio or video file to visualize</p>

              <div className="flex items-center gap-2 mb-6">
                <input
                  type="checkbox"
                  id="autoTranscribe"
                  checked={autoTranscribe}
                  onChange={(e) => setAutoTranscribe(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-600 focus:ring-offset-zinc-900"
                />
                <label htmlFor="autoTranscribe" className="text-sm text-zinc-400 cursor-pointer">
                  Auto-transcribe lyrics with AI
                </label>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full cursor-pointer transition-colors font-medium text-center">
                  Choose File
                  <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileUpload} />
                </label>
                <label className={`px-6 py-3 ${referenceLyrics ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-800 hover:bg-zinc-700'} text-white rounded-full cursor-pointer transition-colors font-medium text-center`}>
                  {referenceLyrics ? 'Reference Lyrics Added' : 'Add Reference Lyrics (JSON/TXT)'}
                  <input type="file" accept=".json,.txt" className="hidden" onChange={handleReferenceUpload} />
                </label>
              </div>
            </div>
          ) : (
            <div
              className="relative bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 transition-all duration-500 flex items-center justify-center"
              style={
                aspectRatio === 'auto'
                  ? { width: '100%', height: '100%' }
                  : aspectRatio === '9:16'
                    ? { height: '100%', aspectRatio: '9/16', maxWidth: '100%' }
                    : { width: '100%', aspectRatio: '16/9', maxHeight: '100%' }
              }
            >
              <Visualizer
                ref={canvasRef}
                analyser={analyserRef.current}
                isPlaying={isPlaying}
                lyrics={lyrics}
                currentTime={currentTime}
                circleConfig={getEffectiveConfig('circle', circleConfig)}
                heartbeatConfig={getEffectiveConfig('heartbeat', heartbeatConfig)}
                waveConfig={getEffectiveConfig('wave', waveConfig)}
                subtleWaveConfig={getEffectiveConfig('subtleWave', subtleWaveConfig)}
                midiConfig={getEffectiveConfig('midi', midiConfig)}
                lyricsConfig={getEffectiveConfig('lyrics', lyricsConfig)}
                backgroundMedia={backgroundImage || (isVideoMode ? audioRef.current : null)}
                backgroundDim={backgroundDim}
              />
            </div>
          )}

          {showSettings && (
            <div className="absolute top-4 right-4 w-80 bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-5 shadow-2xl z-50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium text-white">Visualizer Settings</h3>
                <button onClick={() => setShowSettings(false)} className="text-zinc-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                  <span className="text-sm font-medium text-zinc-300 block mb-3">Aspect Ratio</span>
                  <div className="flex gap-2">
                    <button onClick={() => setAspectRatio('auto')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${aspectRatio === 'auto' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}>Auto</button>
                    <button onClick={() => setAspectRatio('16:9')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${aspectRatio === '16:9' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}><Monitor className="w-3 h-3" /> 16:9</button>
                    <button onClick={() => setAspectRatio('9:16')} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1 ${aspectRatio === '9:16' ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}><Smartphone className="w-3 h-3" /> 9:16</button>
                  </div>
                </div>

                <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-300">Background Image</span>
                    {backgroundImage && (
                      <button onClick={() => setBackgroundImage(null)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
                    )}
                  </div>
                  <label className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer transition-colors text-xs font-medium flex items-center justify-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    {backgroundImage ? 'Change Image' : 'Upload Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
                  </label>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-zinc-500 mb-1">
                      <span>Background Dim</span>
                      <span>{Math.round(backgroundDim * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0" max="1" step="0.01"
                      value={backgroundDim}
                      onChange={e => setBackgroundDim(parseFloat(e.target.value))}
                      className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                <SettingGroup title="Lyrics" config={lyricsConfig} setConfig={setLyricsConfig} />
                <SettingGroup title="MIDI Roll" config={midiConfig} setConfig={setMidiConfig} />
                <SettingGroup title="Circle" config={circleConfig} setConfig={setCircleConfig} />
                <SettingGroup title="Wave" config={waveConfig} setConfig={setWaveConfig} />
                <SettingGroup title="Subtle Wave" config={subtleWaveConfig} setConfig={setSubtleWaveConfig} />
                <SettingGroup title="Heartbeat" config={heartbeatConfig} setConfig={setHeartbeatConfig} />
              </div>
            </div>
          )}

          {isTranscribing && (
            <div className="absolute top-4 right-4 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 px-4 py-2 rounded-full flex items-center gap-3 text-sm text-zinc-300 shadow-xl">
              <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col">
                <span className="font-medium">Transcribing lyrics...</span>
                {duration > 0 && transcribedTime > 0 && (
                  <div className="w-full bg-zinc-800 h-1 mt-1 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all duration-300" style={{ width: `${Math.min(100, (transcribedTime / duration) * 100)}%` }} />
                  </div>
                )}
              </div>
            </div>
          )}

          {isRecording && (
            <div className="absolute top-4 left-4 bg-red-500/20 backdrop-blur-sm border border-red-500/50 px-4 py-2 rounded-full flex items-center gap-2 text-sm text-red-400 font-medium">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              Recording...
            </div>
          )}
        </main>

        {audioUrl && (
          <footer className="py-6 flex flex-col gap-4">
            <div className="flex items-center gap-4 text-xs text-zinc-400 font-mono">
              <span>{formatTime(currentTime)}</span>
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden cursor-pointer relative" onClick={handleSeek}>
                <div className="absolute top-0 left-0 h-full bg-indigo-500" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
              </div>
              <span>{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow-lg shadow-indigo-500/20"
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </button>
                <button
                  onClick={stopAudio}
                  className="w-10 h-10 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 flex items-center justify-center transition-colors"
                >
                  <Square className="w-4 h-4" />
                </button>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-zinc-200 truncate max-w-[200px] sm:max-w-xs">{fileName}</span>
                  <span className="text-xs text-zinc-500">{isPlaying ? 'Playing' : 'Paused'}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isTranscribing && lyrics.length === 0 && audioFile && (
                  <button
                    onClick={() => transcribeAudio(audioFile, referenceLyrics)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="hidden sm:inline">Transcribe Lyrics</span>
                  </button>
                )}

                <button
                  onClick={downloadSRT}
                  disabled={lyrics.length === 0}
                  className={`px-4 py-2 rounded-full transition-colors text-sm font-medium flex items-center gap-2 ${lyrics.length > 0 ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-900 text-zinc-600 cursor-not-allowed'
                    }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Download SRT</span>
                </button>

                <label className={`px-4 py-2 ${referenceLyrics ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'} rounded-full cursor-pointer transition-colors text-sm font-medium flex items-center gap-2`}>
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Ref Lyrics</span>
                  <input type="file" accept=".json,.txt" className="hidden" onChange={handleReferenceUpload} />
                </label>

                <label className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-full cursor-pointer transition-colors text-sm font-medium flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Change Track</span>
                  <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleFileUpload} />
                </label>

                <div className="relative">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="px-4 py-2 rounded-full transition-colors text-sm font-medium flex items-center gap-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/50"
                    >
                      <Square className="w-4 h-4" />
                      <span className="hidden sm:inline">Stop Recording</span>
                    </button>
                  ) : (
                    <div className="flex">
                      <button
                        onClick={() => startRecording('current')}
                        className="px-4 py-2 rounded-l-full transition-colors text-sm font-medium flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white border-r border-indigo-700"
                      >
                        <Download className="w-4 h-4" />
                        <span className="hidden sm:inline">Download Video</span>
                      </button>
                      <button
                        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
                        className="px-2 py-2 rounded-r-full transition-colors bg-indigo-600 hover:bg-indigo-500 text-white"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>

                      {showDownloadMenu && (
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden z-50">
                          <button onClick={() => startRecording('current')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Combined (Current View)</button>
                          <button onClick={() => startRecording('circle')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Circle Only</button>
                          <button onClick={() => startRecording('heartbeat')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Heartbeat Only</button>
                          <button onClick={() => startRecording('wave')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Wave Only</button>
                          <button onClick={() => startRecording('subtleWave')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Subtle Wave Only</button>
                          <button onClick={() => startRecording('midi')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors border-b border-zinc-700/50">Midi Only</button>
                          <button onClick={() => startRecording('lyrics')} className="w-full text-left px-4 py-3 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors">Lyrics Only</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </footer>
        )}

        <video
          ref={audioRef}
          className="hidden"
          playsInline
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        />
      </div>
    </div>
  );
}

function SettingGroup({ title, config, setConfig }: { title: string, config: ElementConfig, setConfig: (c: ElementConfig) => void }) {
  return (
    <div className="bg-zinc-950/50 p-3 rounded-xl border border-zinc-800/50">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-zinc-300">{title}</span>
        <button
          onClick={() => setConfig({ ...config, show: !config.show })}
          className={`w-9 h-5 rounded-full relative transition-colors ${config.show ? 'bg-indigo-500' : 'bg-zinc-700'}`}
        >
          <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${config.show ? 'left-5' : 'left-1'}`} />
        </button>
      </div>
      {config.show && (
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>X Position</span>
              <span>{Math.round(config.x * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={config.x}
              onChange={e => setConfig({ ...config, x: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Y Position</span>
              <span>{Math.round(config.y * 100)}%</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={config.y}
              onChange={e => setConfig({ ...config, y: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Size</span>
              <span>{Math.round((config.size ?? 1) * 100)}%</span>
            </div>
            <input
              type="range" min="0.1" max="3" step="0.1"
              value={config.size ?? 1}
              onChange={e => setConfig({ ...config, size: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Sensitivity</span>
              <span>{Math.round((config.sensitivity ?? 1) * 100)}%</span>
            </div>
            <input
              type="range" min="0.1" max="3" step="0.1"
              value={config.sensitivity ?? 1}
              onChange={e => setConfig({ ...config, sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-500 h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Color Overlay</span>
            <div className="flex items-center gap-2">
              {config.color && (
                <button
                  onClick={() => setConfig({ ...config, color: undefined })}
                  className="text-red-400 hover:text-red-300 px-2 py-0.5 rounded bg-red-500/10"
                >
                  Auto
                </button>
              )}
              <input
                type="color"
                value={config.color || '#ffffff'}
                onChange={e => setConfig({ ...config, color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-none p-0"
              />
            </div>
          </div>
          {config.karaoke !== undefined && (
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
              <span className="text-xs text-zinc-400">Karaoke Fill Effect</span>
              <button
                onClick={() => setConfig({ ...config, karaoke: !config.karaoke })}
                className={`w-7 h-4 rounded-full relative transition-colors ${config.karaoke ? 'bg-indigo-500' : 'bg-zinc-700'}`}
              >
                <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-[3px] transition-transform ${config.karaoke ? 'left-[14px]' : 'left-[3px]'}`} />
              </button>
            </div>
          )}
          {config.showNext !== undefined && (
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-zinc-400">Show Next Line Faded</span>
              <button
                onClick={() => setConfig({ ...config, showNext: !config.showNext })}
                className={`w-7 h-4 rounded-full relative transition-colors ${config.showNext ? 'bg-indigo-500' : 'bg-zinc-700'}`}
              >
                <div className={`w-2.5 h-2.5 bg-white rounded-full absolute top-[3px] transition-transform ${config.showNext ? 'left-[14px]' : 'left-[3px]'}`} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
