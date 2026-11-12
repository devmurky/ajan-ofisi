<!--
  ŞABLON: Kurulumu yapan yapay zekâ bu dosyayı kullanıcının modellerine, ajan adlarına ve diline göre
  uyarlayıp kullanıcının ~/.claude/CLAUDE.md dosyasına ekler. <...> ile gösterilen yerleri doldur.
-->

# Alt ajan sistemi (Antigravity CLI)

<Kullanıcının adı> ile <dil> konuş.

Projelerde işleri Antigravity CLI (`agy`) alt ajanlarına dağıt. Sen yöneticisin: işi planla, ajana ver, sonucu incele, onayla ya da düzeltme iste.

## Ajanlar ve modeller

- Görsel üretimi (logo, ikon, illüstrasyon, sprite, doku, mockup): `<görsel modeli, ör. gemini-4-argon-medium>`
- Zor kod işleri: `<ör. claude-opus-5-5-high>`
- Hızlı ve basit kod işleri: `<ör. claude-sonnet-5-5-medium>`
- <Kota sınırı olan modeller varsa burada belirt: ör. "Görsel modelinin haftalık kotası sınırlı; kod işlerini ona verme.">

## Nasıl çağrılır

```powershell
& "$HOME\agy-tools\ask-agy.ps1" -Prompt "..." -Title "kısa iş adı" -WorkDir <proje klasörü> -Model <model>
```

- Sarmalayıcı raporu `~/agy-tools/out/<iş>.md` dosyasına yazar ve yolunu yazdırır. Raporu oku.
- `generate_image` görselleri otomatik olarak `-WorkDir` klasörüne kopyalanır. Görseli açıp isteğe uyduğunu kontrol et.
- Uzun işleri arka planda çalıştır.
- `agy` etkileşimsiz modda terminal komutlarını reddeder. Durum "blocked" ise komutu kendin çalıştır ya da kullanıcıya sor.
- `-AutoApprove` sadece git altındaki klasörlerde ve kullanıcı onaylarsa.

## Ekip toplantısı (yeni projeler ve büyük incelemeler)

Kullanıcı yeni bir projeye başlarken ya da "projeyi her yönden incele" dediğinde:

```powershell
& "$HOME\agy-tools\toplanti.ps1" -WorkDir <proje klasörü> -Brief "<proje fikri / özeti>" [-Topic "..."] [-Roles mimar,urun,tasarim,guvenlik,kalite,devops]
```

- Rapor proje klasörüne `EKIP-RAPORU-<tarih>.md` olarak yazılır; betiğin son satırı rapor yolu. Raporu oku ve kısaca özetle.
- Uzun sürer: arka planda çalıştır.

## Ajan Ofisi

- Canlı görünüm: http://localhost:4317. <Açılışta otomatik mi, yoksa sadece kullanıcı "ofisi aç" deyince mi açılacağını yaz.>
  - Açmak: `Start-Process wscript.exe -ArgumentList "`"$HOME\agy-tools\ofis\ofis-arka-plan.vbs`""`, sonra `Start-Process http://localhost:4317`.
  - Kapatmak: komut satırında `ofis\server.js` geçen `node.exe` sürecini durdur.
- Kendi adımlarını ofise yaz: `& "$HOME\agy-tools\ofis-not.ps1" -Type plan|review|approve|reject|note -Text "..." [-Target <ajan>] [-Job <iş>]`.
- Akış: `plan` notu → ajana iş → sonucu incele (`review`) → `approve` ya da `reject` + düzeltme işi.
- Claude Code kancaları ofis açıkken senin adımlarını kendiliğinden yazar; bunlar için ayrıca not yazma.

## İnceleme kuralı

- `agy`'nin yaptığı her değişikliği kabul etmeden önce incele: git varsa `git diff`, yoksa raporun "Değişen dosyalar" listesi.
- Şifre, Google girişi ve API anahtarı işlerini kullanıcı yapar.
