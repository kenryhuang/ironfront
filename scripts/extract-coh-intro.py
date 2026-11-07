"""Extract a small cover voice selection from the downloaded community CoH archive."""
import pathlib, struct, zlib, subprocess, json
import imageio_ffmpeg

root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'src/audio/coh-original'
out.mkdir(parents=True, exist_ok=True)
manifest = []
for archive in (root/'artifacts/game-original-voice-research/coh-original').rglob('*.sga'):
    b = archive.read_bytes()
    data_offset = struct.unpack_from('<I', b, 176)[0]
    base = 184
    _, _, fo, fc, eo, ec, no, _ = struct.unpack_from('<IHIHIHIH', b, base)
    def name(n):
        start = base + no + n
        return b[start:b.index(b'\0', start)].decode()
    counts = {}
    for i in range(fc):
        n, _, _, first, last = struct.unpack_from('<I4H', b, base+fo+i*12)
        folder = name(n)
        if not folder.startswith('sound\\wav\\speech\\mp\\'): continue
        event = folder.split('\\')[-1]
        category = {'unitcreated':'deploy', 'attack':'attack', 'underfire':'underfire', 'killed':'death', 'retreat':'rout'}.get(event)
        if not category: continue
        for j in range(first,last):
            n, offset, packed, size, _, _ = struct.unpack_from('<5IH', b, base+eo+j*22)
            filename = name(n)
            if not filename.endswith('.smf') or counts.get(category,0)>=24: continue
            raw = b[data_offset+offset:data_offset+offset+packed]
            if packed < size: raw = zlib.decompress(raw)
            start = raw.find(b'RIFF')
            if start < 0: continue
            stem = ('axis' if 'Axis' in archive.name else 'allies')+'-'+category+'-'+str(counts.get(category,0))
            wav = out/(stem+'.wav'); target = out/(stem+'.ogg')
            wav.write_bytes(raw[start:])
            result = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),'-v','error','-y','-i',str(wav),'-c:a','libvorbis','-q:a','4',str(target)],capture_output=True)
            wav.unlink()
            if result.returncode: print(result.stderr[:160]); continue
            counts[category] = counts.get(category,0)+1
            manifest.append({'file':target.name,'category':category,'source_archive':archive.name,'source_path':folder+'\\'+filename})
    print(archive.name,counts,flush=True)
(out/'manifest.json').write_text(json.dumps({'game':'Company of Heroes','source':'https://steamcommunity.com/sharedfiles/filedetails/?id=647726710','download':'https://drive.google.com/file/d/1L3oXCWtX5gP8izlKaC9-nWUVv7TMwWcF/view','clips':manifest},indent=2),encoding='utf-8')
print('Converted',len(manifest))
