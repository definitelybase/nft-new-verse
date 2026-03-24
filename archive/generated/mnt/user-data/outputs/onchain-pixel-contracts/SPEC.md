# Phase 1: Детальные спецификации OnChainPixel Standard

## 1.1 Формат хранения пикселей

### Принцип: Палитра + Индексы

Каждая коллекция имеет одну глобальную палитру цветов.
Каждый NFT хранит только массив индексов (ссылок на палитру).

```
Палитра (хранится 1 раз в контракте):
┌───────┬─────┬─────┬─────┐
│ Index │  R  │  G  │  B  │
├───────┼─────┼─────┼─────┤
│   0   │  0  │  0  │  0  │  ← чёрный
│   1   │ 255 │  0  │  0  │  ← красный
│   2   │  0  │ 255 │  0  │  ← зелёный
│  ...  │ ... │ ... │ ... │
│  15   │ 255 │ 255 │ 255 │  ← белый
└───────┴─────┴─────┴─────┘

NFT данные (хранится per-token):
┌─────────────────────────────────────┐
│ Пиксели как индексы палитры          │
│ [0, 1, 1, 0, 2, 3, 0, 0, 1, ...]   │
│ Упакованы побитово                   │
└─────────────────────────────────────┘
```

### Битовая упаковка

При 4-bit depth (16 цветов):
- 2 пикселя упакованы в 1 байт
- Старшие 4 бита = первый пиксель
- Младшие 4 бита = второй пиксель

```
Байт: 0xA3
  ├── Пиксель 0: 0xA = 10 (index 10 в палитре)
  └── Пиксель 1: 0x3 = 3  (index 3 в палитре)
```

При 2-bit depth (4 цвета):
- 4 пикселя в 1 байте
- Биты: [7:6] = px0, [5:4] = px1, [3:2] = px2, [1:0] = px3

При 8-bit depth (256 цветов):
- 1 пиксель = 1 байт (без упаковки)

### Порядок пикселей

Сканирование слева направо, сверху вниз (row-major):
```
Для картинки 4x4:
  Позиция в данных:  0  1  2  3
                     4  5  6  7
                     8  9  10 11
                     12 13 14 15

  Координаты → индекс: index = y * width + x
```

### Размер данных для каждой конфигурации

```
Формула: dataSize = (width × height × bitDepth) / 8 байт

┌──────────┬──────────┬──────────┬──────────┐
│ Canvas   │ 2-bit    │ 4-bit    │ 8-bit    │
│          │ (4 цв.)  │ (16 цв.) │ (256 цв.)│
├──────────┼──────────┼──────────┼──────────┤
│ 8×8      │ 16 B     │ 32 B     │ 64 B     │
│ 16×16    │ 64 B     │ 128 B    │ 256 B    │
│ 24×24    │ 144 B    │ 288 B    │ 576 B    │
│ 32×32    │ 256 B    │ 512 B    │ 1024 B   │
│ 48×48    │ 576 B    │ 1152 B   │ 2304 B   │
│ 64×64    │ 1024 B   │ 2048 B   │ 4096 B   │
└──────────┴──────────┴──────────┴──────────┘

Лимит SSTORE2: 24,576 байт на один pointer.
Даже 64×64 при 8-bit = 4096 B — далеко от лимита.
```

---

## 1.2 Интерфейс стандарта (IOnChainPixel)

### ERC-165 Interface ID

```solidity
// Interface ID рассчитывается как XOR всех селекторов функций
// bytes4(keccak256('canvasSize(uint256)')) ^
// bytes4(keccak256('palette()')) ^
// bytes4(keccak256('pixelData(uint256)')) ^
// bytes4(keccak256('getPixel(uint256,uint8,uint8)')) ^
// bytes4(keccak256('renderSVG(uint256)')) ^
// bytes4(keccak256('bitDepth()')) ^
// bytes4(keccak256('paletteSize()'))
```

### Полный интерфейс

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IOnChainPixel — On-Chain Pixel Art Standard
/// @notice ERC extension for NFTs with pixel data stored entirely on-chain
/// @dev Designed to work alongside ERC-721 or ERC-1155
///      Uses SSTORE2 for gas-efficient data storage
///      Supports 2/4/8 bit color depth with global palette
interface IOnChainPixel {
    
    // ============================================================
    //                          EVENTS
    // ============================================================

    /// @notice Emitted when pixel data is stored for a token
    event PixelDataStored(
        uint256 indexed tokenId,
        uint8 width,
        uint8 height
    );

    /// @notice Emitted when the palette is updated
    event PaletteUpdated(uint16 colorCount);

    // ============================================================
    //                      PIXEL DATA
    // ============================================================

    /// @notice Returns canvas dimensions for a token
    function canvasSize(uint256 tokenId)
        external view returns (uint8 width, uint8 height);

    /// @notice Returns raw packed pixel index data
    function pixelData(uint256 tokenId)
        external view returns (bytes memory);

    /// @notice Returns RGB color of a specific pixel
    function getPixel(uint256 tokenId, uint8 x, uint8 y)
        external view returns (uint8 r, uint8 g, uint8 b);

    // ============================================================
    //                        PALETTE
    // ============================================================

    /// @notice Returns the global palette as packed RGB bytes
    /// @return Packed: [R0,G0,B0, R1,G1,B1, ...]
    function palette() external view returns (bytes memory);

    /// @notice Returns number of colors in palette
    function paletteSize() external view returns (uint16);

    // ============================================================
    //                       RENDERING
    // ============================================================

    /// @notice Returns full SVG image for a token
    function renderSVG(uint256 tokenId)
        external view returns (string memory);

    // ============================================================
    //                      CONFIGURATION
    // ============================================================

    /// @notice Returns bits per pixel (2, 4, or 8)
    function bitDepth() external view returns (uint8);
}
```

### Почему именно этот набор функций

| Функция | Зачем | Кто использует |
|---------|-------|----------------|
| `canvasSize` | Знать размеры для рендеринга | Маркетплейсы, другие контракты |
| `pixelData` | Сырые данные для composability | Другие контракты, off-chain tools |
| `getPixel` | Точечное чтение одного пикселя | Игры, генеративные проекты |
| `palette` | Цвета коллекции | Рендереры, фронтенды |
| `paletteSize` | Количество цветов | Валидация, UI |
| `renderSVG` | Полная картинка | tokenURI, маркетплейсы |
| `bitDepth` | Формат данных | Декодеры, другие контракты |

---

## 1.3 Размеры холста

### Поддерживаемые размеры

Контракт поддерживает любой размер от 1×1 до 64×64.
Но рекомендованные размеры для коллекций:

```
Рекомендованные:
  8×8   — микро-иконки, крайне дешёвый минт
  16×16 — классический пиксель-арт (как ранние игры)
  24×24 — формат CryptoPunks
  32×32 — формат Nouns, оптимальный баланс
  48×48 — детализированный пиксель-арт
  64×64 — максимальная детализация
```

### Почему максимум 64×64

- 64×64 при 8-bit = 4096 байт — укладывается в SSTORE2 лимит
- SVG с 4096 rect элементами ≈ 200KB — на грани для on-chain рендеринга
- Больший размер = газ рендеринга превышает block gas limit
- Пиксель-арт эстетика не требует больших размеров

### Ограничения в контракте

```solidity
uint8 constant MIN_SIZE = 1;
uint8 constant MAX_SIZE = 64;

// При минте:
require(width >= MIN_SIZE && width <= MAX_SIZE, "Invalid width");
require(height >= MIN_SIZE && height <= MAX_SIZE, "Invalid height");
require(width * height <= 4096, "Canvas too large"); // 64*64 max pixels
```

---

## 1.4 Битовая глубина

### Три режима

```
┌──────────┬────────┬─────────────┬────────────────────────────┐
│ Bit Depth│ Colors │ Bytes/pixel │ Best for                   │
├──────────┼────────┼─────────────┼────────────────────────────┤
│ 2-bit    │ 4      │ 0.25        │ Монохром, минималист, лого │
│ 4-bit    │ 16     │ 0.5         │ Классический пиксель-арт   │
│ 8-bit    │ 256    │ 1.0         │ Детализированные работы    │
└──────────┴────────┴─────────────┴────────────────────────────┘
```

### Рекомендация: 4-bit как дефолт

Для 90% пиксель-арта 16 цветов достаточно.
Nouns используют ~10 цветов. CryptoPunks ~6-8 цветов per punk.
16 цветов = сладкая точка между качеством и ценой.

Битовая глубина фиксируется при деплое коллекции (immutable).
Нельзя менять после деплоя — это гарантия формата данных.

---

## 1.5 Система сжатия

### Решение: НЕ использовать сжатие в v1

Почему:
1. RLE добавляет сложность декодирования on-chain (больше газа на чтение)
2. При 4-bit 32×32 = 512 байт — уже дёшево без сжатия
3. SSTORE2 и так даёт 3x экономию vs обычный storage
4. Nouns используют RLE потому что хранят в storage, не в SSTORE2
5. Simplicity > Premature optimization

### Будущее: v2 может добавить RLE

```
Если будет востребовано:
- compression() returns uint8 — 0=none, 1=RLE
- Декодер как отдельная library
- Backwards compatible — старые токены не ломаются
```

---

## 1.6 SVG Renderer

### Формат вывода

```xml
<svg xmlns="http://www.w3.org/2000/svg" 
     viewBox="0 0 32 32"
     shape-rendering="crispEdges">
  <rect x="0" y="0" width="1" height="1" fill="#000000"/>
  <rect x="1" y="0" width="1" height="1" fill="#FF0000"/>
  <rect x="2" y="0" width="1" height="1" fill="#FF0000"/>
  ...
</svg>
```

### Оптимизации рендерера

**1. Пропуск прозрачных пикселей**
Если index 0 = transparent, не генерируем rect для него.
Экономит ~30% строки SVG для типичного пиксель-арта.

**2. Горизонтальное объединение (run merging)**
Соседние пиксели одного цвета → один rect с большей шириной.
```
Вместо:
  <rect x="3" y="5" width="1" height="1" fill="#FF0000"/>
  <rect x="4" y="5" width="1" height="1" fill="#FF0000"/>
  <rect x="5" y="5" width="1" height="1" fill="#FF0000"/>

Генерируем:
  <rect x="3" y="5" width="3" height="1" fill="#FF0000"/>
```
Экономит газ на string concatenation (меньше символов).

**3. Hex цвета без # для экономии**
Не работает — SVG требует #. Но можно использовать 
3-символьные hex когда возможно: #F00 вместо #FF0000.

### tokenURI формат

```json
{
  "name": "OnChainPixel #1",
  "description": "Fully on-chain pixel art. No IPFS. No servers. Forever.",
  "image": "data:image/svg+xml;base64,PHN2Zy...",
  "attributes": [
    {"trait_type": "Width", "value": 32},
    {"trait_type": "Height", "value": 32},
    {"trait_type": "Colors", "value": 16},
    {"trait_type": "On-Chain", "value": "true"}
  ]
}
```

Весь JSON кодируется в base64 и возвращается как:
`data:application/json;base64,...`

---

## 1.7 Расчёт стоимости газа

### Методология

Газ SSTORE2.write = 32,000 (base CREATE) + 200 × dataSize (bytes)
Газ ERC-721 mint = ~50,000 (first mint) / ~30,000 (subsequent)
Газ storage writes = ~22,100 per slot (cold) × 2 slots (pointer + dimensions)

### Расчёт для каждого варианта (at 0.11 gwei, ETH $2,000)

```
┌───────────────────┬──────────┬───────────┬──────────┬─────────┐
│ Config            │ Data (B) │ Gas       │ ETH      │ USD     │
├───────────────────┼──────────┼───────────┼──────────┼─────────┤
│ 8×8, 4-bit        │ 32       │ ~113,400  │ 0.000012 │ $0.025  │
│ 16×16, 4-bit      │ 128      │ ~132,600  │ 0.000015 │ $0.029  │
│ 24×24, 4-bit      │ 288      │ ~164,600  │ 0.000018 │ $0.036  │
│ 32×32, 4-bit ★    │ 512      │ ~209,400  │ 0.000023 │ $0.046  │
│ 32×32, 8-bit      │ 1,024    │ ~311,800  │ 0.000034 │ $0.069  │
│ 48×48, 4-bit      │ 1,152    │ ~337,400  │ 0.000037 │ $0.074  │
│ 64×64, 4-bit      │ 2,048    │ ~516,600  │ 0.000057 │ $0.114  │
│ 64×64, 8-bit      │ 4,096    │ ~926,200  │ 0.000102 │ $0.204  │
├───────────────────┼──────────┼───────────┼──────────┼─────────┤
│ ★ = рекомендуемый │          │           │          │         │
└───────────────────┴──────────┴───────────┴──────────┴─────────┘

Breakdown для 32×32, 4-bit (★ рекомендуемый):
  SSTORE2.write(512 bytes)  = 32,000 + 512×200 = 134,400 gas
  ERC-721 mint              = 30,000 gas
  Storage: pointer (20B)    = 22,100 gas
  Storage: width+height     = 22,100 gas (packed in same slot)
  Overhead (events, checks) = ~800 gas
  TOTAL                     ≈ 209,400 gas
  
  At 0.11 gwei: 209,400 × 0.11 = 23,034 gwei = 0.000023 ETH ≈ $0.046
```

### Деплой контракта

```
Contract bytecode (~12KB)    ≈ 3,500,000 gas
Palette write (48B, 16 col)  ≈ 100,000 gas
Constructor logic            ≈ 200,000 gas
TOTAL DEPLOY                 ≈ 3,800,000 gas

At 0.11 gwei: 3,800,000 × 0.11 = 418,000 gwei = 0.000418 ETH ≈ $0.84

Если добавить SVG renderer как отдельный контракт:
Renderer (~8KB)              ≈ 2,500,000 gas = ~$0.55
TOTAL ALL DEPLOYS            ≈ 6,300,000 gas ≈ $1.39
```

### Сравнение с конкурентами

```
┌─────────────────────────┬──────────┬──────────┐
│ Проект                  │ Mint Gas │ On-chain?│
├─────────────────────────┼──────────┼──────────┤
│ Стандартный ERC-721     │ ~80K     │ ❌ IPFS  │
│ ERC-721A (batch)        │ ~30K     │ ❌ IPFS  │
│ OnChainPixel 32×32 4bit │ ~210K    │ ✅ 100%  │
│ Nouns (RLE + storage)   │ ~300K+   │ ✅ 100%  │
│ Autoglyphs             │ ~150K    │ ✅ 100%  │
├─────────────────────────┼──────────┼──────────┤
│ Наш = дешевле Nouns, полностью on-chain      │
└─────────────────────────┴──────────┴──────────┘
```

---

## Checklist Phase 1

- [x] 1.1 Формат хранения: палитра + packed indices ✅
- [x] 1.2 Интерфейс: IOnChainPixel с 7 функциями ✅  
- [x] 1.3 Размеры: 1×1 до 64×64, рекомендован 32×32 ✅
- [x] 1.4 Bit depth: 2/4/8, рекомендован 4-bit (16 цветов) ✅
- [x] 1.5 Сжатие: none в v1, RLE опционально в v2 ✅
- [x] 1.6 SVG renderer: rect-based с run merging ✅
- [x] 1.7 Gas расчёт: ~210K gas (~$0.046) за минт 32×32 ✅

## Решение: Phase 1 завершена → переход к Phase 2 (код)

Конфигурация для первой реализации:
- **Canvas:** 32×32 (default, настраиваемый)
- **Bit depth:** 4-bit (16 цветов)
- **Palette:** 16 RGB цветов, задаётся при деплое
- **Storage:** SSTORE2 (Solady)
- **Rendering:** SVG с run merging
- **Chain:** Ethereum L1
- **Framework:** Foundry
