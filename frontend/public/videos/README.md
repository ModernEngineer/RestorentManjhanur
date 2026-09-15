# Hero slider ki videos

Home page ka full-screen slider (`src/components/HeroVideoSlider.tsx`) yahan se
videos uthata hai. Abhi files nahi hain, isliye har slide ki **poster image**
dikh rahi hai - page phir bhi poora bhara dikhta hai.

## Files daalni kahan hai

Is folder me ye 3 files daal do (naam bilkul yahi rakhna):

```
frontend/public/videos/
├── hero-1.mp4     <- food delivery / pizza wali video
├── hero-2.mp4     <- restaurant dining / table wali video
└── hero-3.mp4     <- birthday party / hall wali video
```

Files daalte hi video apne aap chalne lagegi - code me kuch badalne ki zaroorat
nahi. Dev server chal raha ho to bas page refresh kar lo.

## Video kaisi honi chahiye

| Cheez      | Recommendation                                         |
|------------|--------------------------------------------------------|
| Format     | MP4 (H.264) - saare browsers me chalta hai             |
| Resolution | 1920x1080 (1080p). Isse zyada ki zaroorat nahi         |
| Length     | 8-15 second ka loop (slider har 7 second me badalta hai)|
| Size       | Har file **5 MB se kam** rakho, warna page slow hogi   |
| Audio      | Audio hata do - video muted chalti hai, size bhi bachega|

Ffmpeg se compress karna ho:

```bash
ffmpeg -i original.mp4 -an -vf "scale=1920:-2" -c:v libx264 -crf 28 -preset slow hero-1.mp4
```

(`-an` audio hata deta hai, `-crf 28` size kam karta hai.)

## Slide ka text badalna ho

`src/components/HeroVideoSlider.tsx` me `SLIDES` array hai - wahan har slide ka
`headline`, `sub` aur `poster` likha hai. Slide add/remove karni ho to bas array
me entry add/remove kar do, baaki (dots, auto-rotate) apne aap adjust ho jaata hai.

## Zaroori baatein

- Video **muted + autoplay + loop + playsInline** chalti hai. Browsers sirf muted
  video ko hi autoplay karne dete hain, isliye audio wali video mat daalna.
- Jis user ne OS me "reduce motion" on kiya hai, uske liye slider apne aap ruk
  jaata hai (accessibility).
- Sirf **active slide** ki video chalti hai, baaki paused rehti hain - isse
  CPU aur battery bachti hai.
- Copyright ka dhyan rakhna - apni shoot ki hui ya properly licensed video hi
  use karna (Pexels/Pixabay par free stock videos milti hain).
