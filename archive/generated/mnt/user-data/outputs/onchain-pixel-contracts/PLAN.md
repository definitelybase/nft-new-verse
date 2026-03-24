# OnChainPixel — Fully On-Chain Pixel Art NFT Standard

## Project Vision
Новый ERC-стандарт для хранения пиксельной графики прямо в блокчейне Ethereum L1.
Никаких серверов, IPFS, AWS. Картинка живёт вечно в байткоде контракта.

---

## Tasks

### tasks/todo.md

#### Phase 1: Архитектура и спецификации
- [ ] 1.1 Определить формат хранения пикселей (палитра + индексы)
- [ ] 1.2 Определить интерфейс стандарта (IERC_OnChainPixel)
- [ ] 1.3 Выбрать размеры холста (8x8, 16x16, 32x32, 64x64)
- [ ] 1.4 Определить битовую глубину (2/4/8 бит на пиксель)
- [ ] 1.5 Спроектировать систему сжатия (none, RLE)
- [ ] 1.6 Спроектировать SVG-рендерер on-chain
- [ ] 1.7 Рассчитать точную стоимость газа для каждого варианта

#### Phase 2: Смарт-контракты
- [ ] 2.1 Написать SSTORE2 pixel storage library
- [ ] 2.2 Написать Palette library (глобальная палитра)
- [ ] 2.3 Написать SVG Renderer library
- [ ] 2.4 Написать основной ERC-721 контракт с pixel extension
- [ ] 2.5 Написать mint функцию (юзер передаёт пиксели)
- [ ] 2.6 Написать tokenURI с on-chain SVG
- [ ] 2.7 Написать getPixel(tokenId, x, y) view функцию
- [ ] 2.8 Добавить ERC-165 supportsInterface

#### Phase 3: Тестирование
- [ ] 3.1 Unit тесты: запись и чтение пикселей
- [ ] 3.2 Unit тесты: SVG рендеринг
- [ ] 3.3 Unit тесты: граничные случаи (пустые данные, макс размер)
- [ ] 3.4 Gas benchmarks: минт 8x8, 16x16, 32x32, 64x64
- [ ] 3.5 Gas benchmarks: чтение пикселей
- [ ] 3.6 Интеграционный тест: полный цикл минт → read → render

#### Phase 4: Деплой
- [ ] 4.1 Деплой на Sepolia testnet
- [ ] 4.2 Верифицировать контракт на Etherscan
- [ ] 4.3 Тестовый минт 10 NFT с разными размерами
- [ ] 4.4 Проверить отображение на OpenSea testnet
- [ ] 4.5 Деплой на Ethereum mainnet (при газе < 1 gwei)

#### Phase 5: EIP Draft
- [ ] 5.1 Написать EIP документ по шаблону
- [ ] 5.2 Описать мотивацию и rationale
- [ ] 5.3 Описать backwards compatibility
- [ ] 5.4 Добавить reference implementation
- [ ] 5.5 Подать PR в ethereum/EIPs репозиторий

---

## Architecture Spec

### Формат данных

```
┌─────────────────────────────────────────────────┐
│              CONTRACT (deploy once)              │
├─────────────────────────────────────────────────┤
│                                                  │
│  Global Palette (SSTORE2)                       │
│  ┌──────────────────────────────────────┐       │
│  │ Color 0: [R, G, B] = [0, 0, 0]     │       │
│  │ Color 1: [R, G, B] = [255, 0, 0]   │       │
│  │ Color 2: [R, G, B] = [0, 255, 0]   │       │
│  │ ...                                  │       │
│  │ Color 15: [R, G, B] = [255,255,255] │       │
│  └──────────────────────────────────────┘       │
│  Записывается 1 раз при деплое                  │
│  16 цветов × 3 байта = 48 байт                  │
│                                                  │
│  SVG Renderer (pure function)                   │
│  ┌──────────────────────────────────────┐       │
│  │ Принимает: pixelData + palette      │       │
│  │ Возвращает: SVG string              │       │
│  │ Каждый пиксель → <rect> элемент     │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  Token Storage                                   │
│  ┌──────────────────────────────────────┐       │
│  │ tokenId → SSTORE2 pointer (address) │       │
│  │ tokenId → canvas size (uint8,uint8) │       │
│  └──────────────────────────────────────┘       │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              MINT (user pays)                    │
├─────────────────────────────────────────────────┤
│                                                  │
│  User sends: mint(bytes pixelData, uint8 w, h)  │
│                                                  │
│  Contract:                                       │
│  1. Validate: len(pixelData) == w*h*bitsPerPx/8 │
│  2. SSTORE2.write(pixelData) → pointer          │
│  3. Store: tokenId → pointer                    │
│  4. Store: tokenId → (w, h)                     │
│  5. Mint ERC-721 token                          │
│                                                  │
│  Gas cost (32x32, 4bit):                        │
│  - pixelData = 64 bytes                         │
│  - SSTORE2.write ≈ 55,000 gas                  │
│  - ERC-721 mint ≈ 50,000 gas                   │
│  - Storage (pointer+size) ≈ 45,000 gas          │
│  - Total ≈ 150,000 gas                          │
│  - At 0.11 gwei = $0.03                        │
│                                                  │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│              READ (free, view)                   │
├─────────────────────────────────────────────────┤
│                                                  │
│  tokenURI(tokenId):                             │
│  1. Read pixel data from SSTORE2                │
│  2. Read palette from SSTORE2                   │
│  3. Build SVG: for each pixel → <rect>          │
│  4. Base64 encode                               │
│  5. Return data:application/json;base64,...     │
│     with image: data:image/svg+xml;base64,...   │
│                                                  │
│  getPixel(tokenId, x, y):                       │
│  1. Read pixel data from SSTORE2                │
│  2. Calculate offset: (y * width + x) * bpp    │
│  3. Extract color index                         │
│  4. Lookup RGB in palette                       │
│  5. Return (r, g, b)                            │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Интерфейс стандарта (Draft)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IERC_OnChainPixel — On-Chain Pixel Art Standard
/// @notice Interface for NFTs with pixel data stored entirely on-chain
interface IOnChainPixel {
    
    /// @notice Emitted when pixel data is written for a token
    event PixelDataStored(
        uint256 indexed tokenId, 
        uint8 width, 
        uint8 height, 
        uint8 bitDepth
    );

    /// @notice Returns canvas dimensions for a token
    /// @param tokenId The NFT token ID
    /// @return width Canvas width in pixels
    /// @return height Canvas height in pixels
    function canvasSize(uint256 tokenId) 
        external view returns (uint8 width, uint8 height);
    
    /// @notice Returns the global color palette as packed RGB bytes
    /// @return Packed bytes: [R0,G0,B0, R1,G1,B1, ...]
    function palette() external view returns (bytes memory);
    
    /// @notice Returns raw pixel index data for a token
    /// @param tokenId The NFT token ID
    /// @return Packed pixel indices (2/4/8 bits per pixel)
    function pixelData(uint256 tokenId) 
        external view returns (bytes memory);
    
    /// @notice Returns RGB color of a specific pixel
    /// @param tokenId The NFT token ID
    /// @param x X coordinate (0-indexed)
    /// @param y Y coordinate (0-indexed)
    /// @return r Red component (0-255)
    /// @return g Green component (0-255)  
    /// @return b Blue component (0-255)
    function getPixel(uint256 tokenId, uint8 x, uint8 y) 
        external view returns (uint8 r, uint8 g, uint8 b);
    
    /// @notice Returns the rendered SVG for a token
    /// @param tokenId The NFT token ID
    /// @return SVG string
    function renderSVG(uint256 tokenId) 
        external view returns (string memory);
    
    /// @notice Returns bits per pixel (2, 4, or 8)
    function bitDepth() external view returns (uint8);
    
    /// @notice Returns number of colors in palette
    function paletteSize() external view returns (uint16);
}
```

### Варианты конфигурации

```
┌──────────┬───────────┬──────────┬───────────┬──────────────┐
│ Canvas   │ Bit Depth │ Colors   │ Data Size │ Gas (mint)   │
├──────────┼───────────┼──────────┼───────────┼──────────────┤
│ 8x8      │ 2 bit     │ 4        │ 16 bytes  │ ~100K (~$0.02)│
│ 8x8      │ 4 bit     │ 16       │ 32 bytes  │ ~110K (~$0.02)│
│ 16x16    │ 4 bit     │ 16       │ 128 bytes │ ~130K (~$0.03)│
│ 32x32    │ 4 bit     │ 16       │ 512 bytes │ ~200K (~$0.04)│
│ 32x32    │ 8 bit     │ 256      │ 1024 bytes│ ~300K (~$0.07)│
│ 64x64    │ 4 bit     │ 16       │ 2048 bytes│ ~500K (~$0.11)│
│ 64x64    │ 8 bit     │ 256      │ 4096 bytes│ ~800K (~$0.18)│
└──────────┴───────────┴──────────┴───────────┴──────────────┘

* Gas prices at 0.11 gwei, ETH = $2,000
* SSTORE2 write cost ≈ 200 gas per byte + 32,000 base
```

### Зависимости

```
- OpenZeppelin Contracts v5.x (ERC-721, Ownable, Strings, Base64)
- Solady SSTORE2 (most gas-optimized implementation)
- Foundry (testing framework)
```

### Структура файлов

```
onchain-pixels/
├── contracts/
│   ├── interfaces/
│   │   └── IOnChainPixel.sol        # Интерфейс стандарта
│   ├── libraries/
│   │   ├── PixelStorage.sol          # SSTORE2 обёртка для пикселей
│   │   ├── PaletteLib.sol            # Работа с палитрой
│   │   ├── SVGRenderer.sol           # On-chain SVG генерация
│   │   └── PixelDecoder.sol          # Распаковка бит → индексы
│   ├── OnChainPixelNFT.sol           # Основной контракт
│   └── OnChainPixelNFTFactory.sol    # Фабрика для создания коллекций
├── test/
│   ├── PixelStorage.t.sol
│   ├── SVGRenderer.t.sol
│   ├── OnChainPixelNFT.t.sol
│   └── GasBenchmark.t.sol
├── script/
│   ├── Deploy.s.sol
│   └── MintExample.s.sol
├── tasks/
│   ├── todo.md                       # Этот файл
│   └── lessons.md                    # Уроки из ошибок
├── foundry.toml
└── README.md
```

### Ключевые решения (Architecture Decisions)

**AD-1: SSTORE2 через Solady**
Почему: Solady — самая газо-оптимизированная реализация, аудирована, 
используется в production (Nouns, Art Gobblers). 
Альтернатива: 0xSequence SSTORE2 — менее оптимизирован.

**AD-2: 4-bit depth по умолчанию (16 цветов)**
Почему: Баланс между качеством и ценой. 16 цветов достаточно для 
пиксель-арта. 32x32 = всего 512 байт данных.
Альтернатива: 8-bit (256 цветов) — в 2 раза дороже минт.

**AD-3: Глобальная палитра на коллекцию**
Почему: Экономия газа — палитра записывается один раз при деплое.
Каждый NFT хранит только индексы, не цвета.
Альтернатива: Per-token палитра — дороже, но гибче.

**AD-4: SVG рендеринг on-chain через <rect>**
Почему: SVG рендерится во всех браузерах и маркетплейсах.
Каждый пиксель = один <rect x="" y="" width="1" height="1" fill="#hex"/>.
Альтернатива: BMP/PNG — сложнее генерировать on-chain.

**AD-5: ERC-165 для обнаружения**
Почему: Маркетплейсы и другие контракты могут проверить 
supportsInterface(IOnChainPixel) чтобы знать что NFT fully on-chain.

**AD-6: Factory pattern для коллекций**
Почему: Любой может создать свою коллекцию с собственной палитрой 
и размерами. Стандарт — универсальный, реализация — кастомизируемая.

---

## Lessons Learned

### tasks/lessons.md
(будет обновляться по мере разработки)

- [ ] Пока пусто — заполняется после каждой ошибки/коррекции

---

## Core Principles

- **Simplicity First**: Минимальный код, максимальная эффективность газа
- **No Laziness**: Никаких временных решений. Каждая функция — production ready
- **Verification Before Done**: Каждый контракт тестируется + gas benchmark
- **Demand Elegance**: Код должен быть таким, чтобы Ethereum core devs одобрили

---

## Gas Budget (at 0.11 gwei, ETH $2,000)

| Action              | Gas       | Cost     | Who Pays  |
|---------------------|-----------|----------|-----------|
| Deploy contract     | ~4,000,000| ~$0.88   | Creator   |
| Deploy palette      | ~100,000  | ~$0.02   | Creator   |
| Deploy renderer     | ~2,000,000| ~$0.44   | Creator   |
| **Total deploy**    |**~6.1M**  |**~$1.34**| **Creator**|
| Mint 32x32 4bit     | ~150,000  | ~$0.03   | Minter    |
| Mint 16x16 4bit     | ~120,000  | ~$0.03   | Minter    |
| Read pixel (view)   | 0         | Free     | Anyone    |
| Render SVG (view)   | 0         | Free     | Anyone    |
