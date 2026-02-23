import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

export interface LyricWord {
  word: string;
  startTime: number;
  endTime: number;
}

export interface LyricLine {
  startTime: number;
  endTime: number;
  text: string;
  words?: LyricWord[];
}

export interface ElementConfig {
  show: boolean;
  x: number;
  y: number;
  karaoke?: boolean;
  showNext?: boolean;
}

interface VisualizerProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  lyrics: LyricLine[];
  currentTime: number;
  circleConfig: ElementConfig;
  waveConfig: ElementConfig;
  subtleWaveConfig: ElementConfig;
  midiConfig: ElementConfig;
  lyricsConfig: ElementConfig;
  backgroundMedia: HTMLImageElement | HTMLVideoElement | null;
  backgroundDim?: number;
}

const Visualizer = forwardRef<HTMLCanvasElement, VisualizerProps>(({
  analyser, isPlaying, lyrics, currentTime, circleConfig, waveConfig, subtleWaveConfig, midiConfig, lyricsConfig, backgroundMedia, backgroundDim = 0.75
}, ref) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const smoothedMoodRef = useRef({ r: 100, g: 50, b: 255, hueOffset: 0 });
  const midiHistoryRef = useRef<Uint8Array[]>([]);

  useImperativeHandle(ref, () => internalCanvasRef.current as HTMLCanvasElement);

  useEffect(() => {
    if (!internalCanvasRef.current) return;

    const canvas = internalCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dataArray: Uint8Array;
    let dataArrayTime: Uint8Array;
    let bufferLength = 0;

    if (analyser) {
      bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      dataArrayTime = new Uint8Array(bufferLength);
    }

    const draw = () => {
      requestRef.current = requestAnimationFrame(draw);

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;

      if (backgroundMedia) {
        ctx.clearRect(0, 0, width, height);

        let mediaWidth = 0;
        let mediaHeight = 0;
        if (backgroundMedia instanceof HTMLVideoElement) {
          mediaWidth = backgroundMedia.videoWidth;
          mediaHeight = backgroundMedia.videoHeight;
        } else {
          mediaWidth = backgroundMedia.width;
          mediaHeight = backgroundMedia.height;
        }

        const imgRatio = mediaWidth && mediaHeight ? mediaWidth / mediaHeight : 1;
        const canvasRatio = width / height;
        let drawWidth = width;
        let drawHeight = height;
        let offsetX = 0;
        let offsetY = 0;

        if (imgRatio > canvasRatio) {
          drawWidth = height * imgRatio;
          offsetX = (width - drawWidth) / 2;
        } else {
          drawHeight = width / imgRatio;
          offsetY = (height - drawHeight) / 2;
        }
        ctx.drawImage(backgroundMedia, offsetX, offsetY, drawWidth, drawHeight);
        ctx.fillStyle = `rgba(10, 10, 15, ${backgroundDim})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = `rgba(10, 10, 15, ${Math.min(backgroundDim, 0.3)})`;
        ctx.fillRect(0, 0, width, height);
      }

      if (analyser && isPlaying) {
        // Draw Circle
        if (circleConfig.show) {
          analyser.getByteFrequencyData(dataArray);
          const cx = width * circleConfig.x;
          const cy = height * circleConfig.y;
          const radius = Math.min(width, height) * 0.25;
          const avg = dataArray.reduce((a, b) => a + b, 0) / bufferLength;

          let bass = 0, mid = 0, treble = 0;
          const third = Math.floor(bufferLength / 3);
          if (third > 0) {
            for (let i = 0; i < third; i++) bass += dataArray[i];
            for (let i = third; i < 2 * third; i++) mid += dataArray[i];
            for (let i = 2 * third; i < bufferLength; i++) treble += dataArray[i];
            bass /= third;
            mid /= third;
            treble /= third;
          }

          const targetR = Math.min(255, bass * 1.5 + 50);
          const targetG = Math.min(255, treble * 1.5 + 50);
          const targetB = Math.min(255, mid * 1.5 + 100);
          const targetHueOffset = bass * 0.5 + mid * 0.3 + treble * 0.2;

          smoothedMoodRef.current.r += (targetR - smoothedMoodRef.current.r) * 0.05;
          smoothedMoodRef.current.g += (targetG - smoothedMoodRef.current.g) * 0.05;
          smoothedMoodRef.current.b += (targetB - smoothedMoodRef.current.b) * 0.05;
          smoothedMoodRef.current.hueOffset += (targetHueOffset - smoothedMoodRef.current.hueOffset) * 0.05;

          const { r, g, b, hueOffset } = smoothedMoodRef.current;

          ctx.beginPath();
          ctx.arc(cx, cy, radius + avg * 0.3, 0, 2 * Math.PI);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(avg / 255) * 0.4})`;
          ctx.fill();

          const bars = 120;
          const step = Math.floor((bufferLength * 0.5) / bars);

          for (let i = 0; i < bars; i++) {
            const val = dataArray[i * step];
            const rads = (Math.PI * 2 * i) / bars - Math.PI / 2;
            const barHeight = val * 0.6;

            const x = cx + Math.cos(rads) * radius;
            const y = cy + Math.sin(rads) * radius;
            const xEnd = cx + Math.cos(rads) * (radius + barHeight);
            const yEnd = cy + Math.sin(rads) * (radius + barHeight);

            ctx.strokeStyle = `hsla(${((i / bars) * 360 + hueOffset) % 360}, 80%, 60%, 0.4)`;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(xEnd, yEnd);
            ctx.stroke();
          }
        }

        // Draw Wave
        if (waveConfig.show) {
          analyser.getByteFrequencyData(dataArray);

          const waveY = height * waveConfig.y;
          const numPoints = 120;
          const sliceWidth = width / numPoints;

          const { hueOffset } = smoothedMoodRef.current;

          ctx.beginPath();
          ctx.moveTo(0, waveY);

          // Top half
          for (let i = 0; i <= numPoints; i++) {
            // Mirror the frequency data from center
            const distFromCenter = Math.abs(i - numPoints / 2) / (numPoints / 2);
            const binIndex = Math.floor((1 - distFromCenter) * (bufferLength * 0.25));
            const val = dataArray[binIndex] || 0;
            const yOffset = (val / 255) * (height * 0.15);

            // Smooth out the edges
            const edgeSmoothing = 1 - Math.pow(distFromCenter, 2);

            ctx.lineTo(i * sliceWidth, waveY - (yOffset * edgeSmoothing));
          }

          // Bottom half
          for (let i = numPoints; i >= 0; i--) {
            const distFromCenter = Math.abs(i - numPoints / 2) / (numPoints / 2);
            const binIndex = Math.floor((1 - distFromCenter) * (bufferLength * 0.25));
            const val = dataArray[binIndex] || 0;
            const yOffset = (val / 255) * (height * 0.15);

            const edgeSmoothing = 1 - Math.pow(distFromCenter, 2);

            ctx.lineTo(i * sliceWidth, waveY + (yOffset * edgeSmoothing));
          }

          ctx.closePath();

          // Gradient fill
          const gradient = ctx.createLinearGradient(0, 0, width, 0);
          gradient.addColorStop(0, `hsla(${hueOffset % 360}, 80%, 60%, 0.0)`);
          gradient.addColorStop(0.2, `hsla(${(hueOffset + 30) % 360}, 80%, 60%, 0.4)`);
          gradient.addColorStop(0.5, `hsla(${(hueOffset + 60) % 360}, 80%, 60%, 0.8)`);
          gradient.addColorStop(0.8, `hsla(${(hueOffset + 90) % 360}, 80%, 60%, 0.4)`);
          gradient.addColorStop(1, `hsla(${(hueOffset + 120) % 360}, 80%, 60%, 0.0)`);

          ctx.fillStyle = gradient;
          ctx.fill();

          // Outline
          ctx.lineWidth = 2;
          ctx.strokeStyle = `hsla(${(hueOffset + 60) % 360}, 80%, 80%, 0.8)`;
          ctx.stroke();
        }

        // Draw Subtle Wave
        if (subtleWaveConfig.show) {
          analyser.getByteFrequencyData(dataArray);

          const waveY = height * subtleWaveConfig.y;
          const numPoints = 80;
          const sliceWidth = width / numPoints;

          const { r, g, b } = smoothedMoodRef.current;

          ctx.beginPath();
          ctx.moveTo(0, waveY);

          for (let i = 0; i <= numPoints; i++) {
            // Mirror from center but keep it much smaller and smoother
            const distFromCenter = Math.abs(i - numPoints / 2) / (numPoints / 2);
            const binIndex = Math.floor((1 - distFromCenter) * (bufferLength * 0.1)); // only lower frequencies
            const val = dataArray[binIndex] || 0;

            // Subtle height calculation
            const yOffset = (val / 255) * (height * 0.04);
            const edgeSmoothing = Math.pow(1 - distFromCenter, 2); // Smoother tapering

            // Draw a single smooth sine-like wave
            const offset = Math.sin(Date.now() / 500 + i * 0.1) * (val / 255) * 5;
            ctx.lineTo(i * sliceWidth, waveY - (yOffset * edgeSmoothing) + offset);
          }

          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.6)`;
          ctx.shadowBlur = 10;
          ctx.shadowColor = `rgba(${r}, ${g}, ${b}, 0.8)`;
          ctx.stroke();
          ctx.shadowBlur = 0; // reset shadow
        }

        // Draw MIDI
        if (midiConfig.show) {
          analyser.getByteFrequencyData(dataArray);
          midiHistoryRef.current.unshift(new Uint8Array(dataArray));
          const maxHistory = Math.floor(height / 8); // speed of falling
          if (midiHistoryRef.current.length > maxHistory) {
            midiHistoryRef.current.pop();
          }

          const mx = width * midiConfig.x;
          const my = height * midiConfig.y;
          const midiWidth = width * 0.9;
          const midiHeight = height * 0.6;
          const startX = mx - midiWidth / 2;
          const startY = my - midiHeight / 2;

          const numKeys = 88;
          const keyWidth = midiWidth / numKeys;
          const rowHeight = midiHeight / maxHistory;

          const { hueOffset } = smoothedMoodRef.current;

          ctx.save();

          // Draw falling notes
          for (let h = 0; h < midiHistoryRef.current.length; h++) {
            const rowData = midiHistoryRef.current[h];
            const y = startY + midiHeight - (h * rowHeight);

            for (let i = 0; i < numKeys; i++) {
              // Non-linear mapping to emphasize musical notes
              const binIndex = Math.floor(Math.pow(i / numKeys, 2) * 150) + 2;
              const val = rowData[binIndex];

              if (val > 100) {
                const intensity = (val - 100) / 155;
                ctx.fillStyle = `hsla(${((i / numKeys) * 360 + hueOffset) % 360}, 80%, 60%, ${intensity * 0.9})`;
                ctx.fillRect(startX + i * keyWidth + 1, y - rowHeight, keyWidth - 2, rowHeight + 1);
              }
            }
          }

          // Draw "keyboard" or base line at the bottom
          for (let i = 0; i < numKeys; i++) {
            const binIndex = Math.floor(Math.pow(i / numKeys, 2) * 150) + 2;
            const val = dataArray[binIndex];
            const isPressed = val > 100;

            ctx.fillStyle = isPressed ? `hsla(${((i / numKeys) * 360 + hueOffset) % 360}, 80%, 70%, 1)` : 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(startX + i * keyWidth + 1, startY + midiHeight, keyWidth - 2, 8);
          }

          ctx.restore();
        }
      }

      // Draw Lyrics
      if (lyricsConfig.show && lyrics && lyrics.length > 0) {
        const PRE_ROLL = 0.4;
        const POST_ROLL = 0.4;

        let activeIndex = lyrics.findIndex(line => currentTime >= line.startTime && currentTime <= line.endTime);
        if (activeIndex === -1) {
          activeIndex = lyrics.findIndex(line => currentTime >= line.startTime - PRE_ROLL && currentTime <= line.endTime + POST_ROLL);
        }

        const activeLine = activeIndex !== -1 ? lyrics[activeIndex] : null;
        let nextLine = null;

        if (activeIndex !== -1) {
          if (activeIndex + 1 < lyrics.length) {
            nextLine = lyrics[activeIndex + 1];
          }
        } else {
          nextLine = lyrics.find(line => line.startTime > currentTime);
        }

        const lx = width * lyricsConfig.x;
        const ly = height * lyricsConfig.y;
        const maxWidth = width * 0.9;

        if (activeLine) {
          let progress = 0;
          let opacity = 0;
          let scale = 0.8;
          let yOffset = 0;

          if (currentTime < activeLine.startTime) {
            // Animating in (Bounce)
            progress = (currentTime - (activeLine.startTime - PRE_ROLL)) / PRE_ROLL;

            // easeOutBack for bounce effect
            const c1 = 1.70158;
            const c3 = c1 + 1;
            const bounceEase = 1 + c3 * Math.pow(progress - 1, 3) + c1 * Math.pow(progress - 1, 2);

            // easeOutQuad for opacity
            opacity = 1 - (1 - progress) * (1 - progress);

            scale = 0.5 + 0.5 * bounceEase;
            yOffset = 40 * (1 - bounceEase);
          } else if (currentTime > activeLine.endTime) {
            // Animating out (Fade-out-down)
            progress = (currentTime - activeLine.endTime) / POST_ROLL;
            const ease = progress * progress; // easeInQuad
            opacity = 1 - ease;
            scale = 1 - 0.1 * ease;
            yOffset = 40 * ease; // Move down
          } else {
            // Fully visible
            opacity = 1;
            scale = 1;
            yOffset = 0;
          }

          ctx.save();
          ctx.translate(lx, ly + yOffset);
          ctx.scale(scale, scale);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          ctx.shadowColor = 'rgba(168, 85, 247, 0.8)';
          ctx.shadowBlur = 20 + (Math.sin(Date.now() / 200) * 10);
          ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';

          if (lyricsConfig.karaoke) {
            let fillProgress = 0;

            if (activeLine.words && activeLine.words.length > 0) {
              const totalWidth = Math.min(ctx.measureText(activeLine.text).width, maxWidth);

              if (currentTime < activeLine.startTime) {
                fillProgress = 0;
              } else if (currentTime > activeLine.endTime) {
                fillProgress = 1;
              } else {
                let passedWidth = 0;
                for (let i = 0; i < activeLine.words.length; i++) {
                  const w = activeLine.words[i];
                  const wordText = w.word + (i < activeLine.words.length - 1 ? " " : "");
                  const wordWidth = ctx.measureText(wordText).width;

                  if (currentTime > w.endTime) {
                    passedWidth += wordWidth;
                  } else if (currentTime >= w.startTime && currentTime <= w.endTime) {
                    const wordProgress = (currentTime - w.startTime) / (w.endTime - w.startTime);
                    passedWidth += wordWidth * wordProgress;
                    break;
                  } else if (currentTime < w.startTime) {
                    break;
                  }
                }
                fillProgress = passedWidth / totalWidth;
              }
            } else {
              if (currentTime >= activeLine.startTime && currentTime <= activeLine.endTime) {
                fillProgress = (currentTime - activeLine.startTime) / (activeLine.endTime - activeLine.startTime);
              } else if (currentTime > activeLine.endTime) {
                fillProgress = 1;
              }
            }

            // Draw faded background text
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
            ctx.fillText(activeLine.text, 0, 0, maxWidth);

            // Draw filled text
            ctx.save();
            ctx.beginPath();
            const textWidth = Math.min(ctx.measureText(activeLine.text).width, maxWidth);
            const startX = -textWidth / 2;
            ctx.rect(startX, -100, textWidth * fillProgress, 200);
            ctx.clip();
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fillText(activeLine.text, 0, 0, maxWidth);
            ctx.restore();
          } else {
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fillText(activeLine.text, 0, 0, maxWidth);
          }

          ctx.restore();
        }

        if (lyricsConfig.showNext && nextLine) {
          let nextOpacity = 0.4;
          let nextYOffset = 80;

          if (!activeLine) {
            const timeUntil = nextLine.startTime - currentTime;
            if (timeUntil < 2) {
              nextOpacity = 0.4 * (1 - timeUntil / 2);
            } else {
              nextOpacity = 0;
            }
          }

          if (nextOpacity > 0) {
            ctx.save();
            ctx.translate(lx, ly + nextYOffset);
            ctx.scale(0.6, 0.6);
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = `rgba(255, 255, 255, ${nextOpacity})`;
            ctx.font = '600 64px system-ui, -apple-system, sans-serif';
            ctx.fillText(nextLine.text, 0, 0, maxWidth);
            ctx.restore();
          }
        }
      }
    };

    draw();

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [analyser, isPlaying, lyrics, currentTime, circleConfig, waveConfig, subtleWaveConfig, midiConfig, lyricsConfig, backgroundMedia, backgroundDim]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (internalCanvasRef.current) {
        const canvas = internalCanvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.offsetWidth * dpr;
        canvas.height = canvas.offsetHeight * dpr;
        const ctx = canvas.getContext('2d');
        ctx?.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <canvas
      ref={internalCanvasRef}
      className="w-full h-full block bg-[#0a0a0f] rounded-2xl shadow-2xl border border-white/5"
    />
  );
});

export default Visualizer;
