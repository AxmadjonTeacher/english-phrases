import os
import json
import asyncio
import edge_tts

VOICE = "en-US-JennyNeural"
AUDIO_DIR = "/Users/ahmetyadgarov/.gemini/antigravity/scratch/curator-flashcards/audio"

async def generate_single(sem, phrase, idx, total):
    async with sem:
        out_path = os.path.join(AUDIO_DIR, f"{phrase['id']}.mp3")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 100:
            print(f"[{idx+1}/{total}] Skipping (already exists): {phrase['id']}")
            return
        
        text = phrase["english"]
        # clean text for speech
        text = text.replace('"', '').strip()
        
        communicate = edge_tts.Communicate(text, VOICE)
        try:
            await communicate.save(out_path)
            print(f"[{idx+1}/{total}] Generated {phrase['id']}: {text[:30]}...")
        except Exception as e:
            print(f"[{idx+1}/{total}] Error generating {phrase['id']}: {e}")

async def main():
    os.makedirs(AUDIO_DIR, exist_ok=True)
    with open("/Users/ahmetyadgarov/.gemini/antigravity/scratch/curator-flashcards/phrases.json", "r", encoding="utf-8") as f:
        phrases = json.load(f)
    
    total = len(phrases)
    sem = asyncio.Semaphore(6)
    tasks = [generate_single(sem, p, i, total) for i, p in enumerate(phrases)]
    await asyncio.gather(*tasks)
    print("All audio files generated successfully!")

if __name__ == "__main__":
    asyncio.run(main())
