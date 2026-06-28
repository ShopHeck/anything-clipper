import { describe, expect, it } from 'vitest';
import { buildUGCFfmpegArgs, buildZoompanFilter } from './ffmpeg-compose';
import type { UGCRenderSpec } from './types';

const baseSpec: UGCRenderSpec = {
  ttsAudioUrl: 'https://example.com/voiceover.mp3',
  scenes: [
    { startSec: 0, endSec: 5, imageUrl: 'https://example.com/img1.jpg' },
    { startSec: 5, endSec: 10, imageUrl: 'https://example.com/img2.jpg' },
    { startSec: 10, endSec: 15, imageUrl: 'https://example.com/img3.jpg' },
  ],
  captions: [],
  aspect: '9:16',
  captionTemplateId: 'mrBeast',
};

describe('buildZoompanFilter', () => {
  it('generates zoom-in filter with correct duration frames', () => {
    const filter = buildZoompanFilter('in', 150, 1080, 1920);
    expect(filter).toContain('zoompan=');
    expect(filter).toContain('d=150');
    expect(filter).toContain('s=1080x1920');
    expect(filter).toContain('fps=30');
    expect(filter).toContain('1.25');
  });

  it('generates zoom-out filter', () => {
    const filter = buildZoompanFilter('out', 210, 1080, 1920);
    expect(filter).toContain('zoompan=');
    expect(filter).toContain('d=210');
    expect(filter).toContain('1.25');
    expect(filter).toContain('max(');
  });

  it('generates pan-left filter with fixed zoom', () => {
    const filter = buildZoompanFilter('pan-left', 180, 1080, 1920);
    expect(filter).toContain("z='1.1'");
    expect(filter).toContain('d=180');
    expect(filter).toContain('s=1080x1920');
  });

  it('generates pan-right filter with fixed zoom', () => {
    const filter = buildZoompanFilter('pan-right', 180, 1080, 1920);
    expect(filter).toContain("z='1.1'");
    expect(filter).toContain('d=180');
  });
});

describe('buildUGCFfmpegArgs', () => {
  it('produces valid ffmpeg args with H.264 encoding', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const joined = args.join(' ');
    expect(joined).toContain('-c:v libx264');
    expect(joined).toContain('-preset veryfast');
    expect(joined).toContain('-crf 19');
    expect(joined).toContain('-pix_fmt yuv420p');
    expect(joined).toContain('-c:a aac');
    expect(joined).toContain('-b:a 192k');
    expect(joined).toContain('+faststart');
    expect(args[args.length - 1]).toBe('/tmp/output.mp4');
  });

  it('includes loop and duration for each image input', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const joined = args.join(' ');
    // First scene: 5 seconds
    expect(joined).toContain('-loop 1 -t 5 -i /tmp/img1.jpg');
    // Second scene: 5 seconds
    expect(joined).toContain('-loop 1 -t 5 -i /tmp/img2.jpg');
    // Third scene: 5 seconds
    expect(joined).toContain('-loop 1 -t 5 -i /tmp/img3.jpg');
  });

  it('includes TTS audio as input', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    expect(args).toContain('/tmp/voice.mp3');
  });

  it('applies zoompan filter to each image scene', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('zoompan=');
    expect(graph).toContain('[scene0]');
    expect(graph).toContain('[scene1]');
    expect(graph).toContain('[scene2]');
  });

  it('concatenates all scenes', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[scene0][scene1][scene2]concat=n=3:v=1:a=0[vraw]');
  });

  it('burns ASS captions when provided', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      assPath: '/tmp/captions.ass',
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain("subtitles=filename=/tmp/captions.ass");
  });

  it('passes through without ASS when no assPath', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[vraw]null[v]');
  });

  it('mixes background music at the specified volume', () => {
    const specWithMusic: UGCRenderSpec = {
      ...baseSpec,
      backgroundMusicUrl: 'https://example.com/music.mp3',
      backgroundMusicVolume: 0.2,
    };
    const args = buildUGCFfmpegArgs({
      spec: specWithMusic,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      musicPath: '/tmp/music.mp3',
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const joined = args.join(' ');
    expect(joined).toContain('-stream_loop -1 -i /tmp/music.mp3');
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('volume=0.2[bed]');
    expect(graph).toContain('amix=inputs=2:duration=first:normalize=0[a]');
  });

  it('uses default volume (0.15) when not specified', () => {
    const specWithMusic: UGCRenderSpec = {
      ...baseSpec,
      backgroundMusicUrl: 'https://example.com/music.mp3',
    };
    const args = buildUGCFfmpegArgs({
      spec: specWithMusic,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      musicPath: '/tmp/music.mp3',
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('volume=0.15[bed]');
  });

  it('handles a single scene', () => {
    const singleScene: UGCRenderSpec = {
      ...baseSpec,
      scenes: [{ startSec: 0, endSec: 10, imageUrl: 'https://example.com/img.jpg' }],
    };
    const args = buildUGCFfmpegArgs({
      spec: singleScene,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 10,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('[scene0]concat=n=1:v=1:a=0[vraw]');
    expect(graph).toContain('zoompan=');
  });

  it('applies custom zoom directions per scene', () => {
    const specWithDirections: UGCRenderSpec = {
      ...baseSpec,
      scenes: [
        { startSec: 0, endSec: 5, imageUrl: 'https://example.com/img1.jpg', zoomDirection: 'out' },
        {
          startSec: 5,
          endSec: 10,
          imageUrl: 'https://example.com/img2.jpg',
          zoomDirection: 'pan-left',
        },
      ],
    };
    const args = buildUGCFfmpegArgs({
      spec: specWithDirections,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 10,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    // Zoom out uses 'max' to decrease from 1.25 to 1.0
    expect(graph).toContain('max(');
    // Pan-left uses fixed zoom '1.1'
    expect(graph).toContain("z='1.1'");
  });

  it('outputs 9:16 vertical video dimensions', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toContain('scale=1080:1920');
    expect(graph).toContain('crop=1080:1920');
  });

  it('uses -shortest flag to cap output to TTS audio length', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    expect(args).toContain('-shortest');
  });

  it('maps video and audio outputs', () => {
    const args = buildUGCFfmpegArgs({
      spec: baseSpec,
      ttsAudioPath: '/tmp/voice.mp3',
      sceneAssetPaths: ['/tmp/img1.jpg', '/tmp/img2.jpg', '/tmp/img3.jpg'],
      outPath: '/tmp/output.mp4',
      totalDurationSec: 15,
    });
    expect(args).toContain('-map');
    expect(args).toContain('[v]');
    expect(args).toContain('[a]');
  });

  describe('video clip scenes', () => {
    it('loops video clips to fill the scene window (no -ss when clipStartSec is unset)', () => {
      const videoSpec: UGCRenderSpec = {
        ...baseSpec,
        scenes: [
          { startSec: 0, endSec: 5, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip1.mp4' },
          { startSec: 5, endSec: 10, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip2.mp4' },
        ],
      };
      const args = buildUGCFfmpegArgs({
        spec: videoSpec,
        ttsAudioPath: '/tmp/voice.mp3',
        sceneAssetPaths: ['/tmp/clip1.mp4', '/tmp/clip2.mp4'],
        outPath: '/tmp/output.mp4',
        totalDurationSec: 10,
      });
      const joined = args.join(' ');
      expect(joined).toContain('-stream_loop -1 -t 5 -i /tmp/clip1.mp4');
      expect(joined).toContain('-stream_loop -1 -t 5 -i /tmp/clip2.mp4');
      expect(joined).not.toContain('-loop 1');
      expect(joined).not.toContain('-ss');
    });

    it('input-seeks to the avatar window when clipStartSec is set', () => {
      const avatarSpec: UGCRenderSpec = {
        ...baseSpec,
        scenes: [
          { startSec: 0, endSec: 4, imageUrl: '', isVideoClip: true, videoUrl: 'a.mp4', clipStartSec: 0 },
          { startSec: 20, endSec: 25, imageUrl: '', isVideoClip: true, videoUrl: 'a.mp4', clipStartSec: 20 },
        ],
      };
      const args = buildUGCFfmpegArgs({
        spec: avatarSpec,
        ttsAudioPath: '/tmp/voice.mp3',
        sceneAssetPaths: ['/tmp/avatar.mp4', '/tmp/avatar.mp4'],
        outPath: '/tmp/output.mp4',
        totalDurationSec: 25,
      });
      const joined = args.join(' ');
      // Avatar windows seek into the full-length clip; they do not loop.
      expect(joined).toContain('-ss 0 -t 4 -i /tmp/avatar.mp4');
      expect(joined).toContain('-ss 20 -t 5 -i /tmp/avatar.mp4');
      expect(joined).not.toContain('-stream_loop');
    });

    it('does not apply zoompan filter to video clips', () => {
      const videoSpec: UGCRenderSpec = {
        ...baseSpec,
        scenes: [
          { startSec: 0, endSec: 5, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip.mp4' },
        ],
      };
      const args = buildUGCFfmpegArgs({
        spec: videoSpec,
        ttsAudioPath: '/tmp/voice.mp3',
        sceneAssetPaths: ['/tmp/clip.mp4'],
        outPath: '/tmp/output.mp4',
        totalDurationSec: 5,
      });
      const graph = args[args.indexOf('-filter_complex') + 1];
      expect(graph).not.toContain('zoompan');
    });

    it('applies scale+crop+setpts to video clips', () => {
      const videoSpec: UGCRenderSpec = {
        ...baseSpec,
        scenes: [
          { startSec: 0, endSec: 6, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip.mp4' },
        ],
      };
      const args = buildUGCFfmpegArgs({
        spec: videoSpec,
        ttsAudioPath: '/tmp/voice.mp3',
        sceneAssetPaths: ['/tmp/clip.mp4'],
        outPath: '/tmp/output.mp4',
        totalDurationSec: 6,
      });
      const graph = args[args.indexOf('-filter_complex') + 1];
      expect(graph).toContain('scale=1080:1920:force_original_aspect_ratio=increase');
      expect(graph).toContain('crop=1080:1920');
      expect(graph).toContain('setpts=PTS-STARTPTS');
    });

    it('handles mixed video clips and image scenes', () => {
      const mixedSpec: UGCRenderSpec = {
        ...baseSpec,
        scenes: [
          { startSec: 0, endSec: 5, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip.mp4' },
          { startSec: 5, endSec: 10, imageUrl: 'https://example.com/img.jpg' },
          { startSec: 10, endSec: 15, imageUrl: '', isVideoClip: true, videoUrl: 'https://example.com/clip2.mp4' },
        ],
      };
      const args = buildUGCFfmpegArgs({
        spec: mixedSpec,
        ttsAudioPath: '/tmp/voice.mp3',
        sceneAssetPaths: ['/tmp/clip.mp4', '/tmp/img.jpg', '/tmp/clip2.mp4'],
        outPath: '/tmp/output.mp4',
        totalDurationSec: 15,
      });
      const joined = args.join(' ');
      const graph = args[args.indexOf('-filter_complex') + 1];

      // First scene: video clip (loops to fill, no -loop 1)
      expect(joined).toContain('-stream_loop -1 -t 5 -i /tmp/clip.mp4');
      // Second scene: image (has -loop 1)
      expect(joined).toContain('-loop 1 -t 5 -i /tmp/img.jpg');
      // Third scene: video clip (loops to fill)
      expect(joined).toContain('-stream_loop -1 -t 5 -i /tmp/clip2.mp4');

      // First and third scene should NOT have zoompan
      // Second scene SHOULD have zoompan
      expect(graph).toContain('zoompan');
      // All three should be concatenated
      expect(graph).toContain('[scene0][scene1][scene2]concat=n=3:v=1:a=0[vraw]');
    });
  });
});
