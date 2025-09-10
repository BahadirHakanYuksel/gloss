/* eslint-disable @typescript-eslint/no-explicit-any */

import CryptoJS from "crypto-js";

const STORAGE_KEY_PREFIX = "glos_";
const ENCRYPTION_KEY = "glos_secure_key_2024";

export class SecureStorage {
  private static encrypt(data: string): string {
    return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY).toString();
  }

  private static decrypt(encryptedData: string): string {
    const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  static setItem(key: string, value: any): void {
    try {
      const serializedValue = JSON.stringify(value);
      const encryptedValue = this.encrypt(serializedValue);
      localStorage.setItem(STORAGE_KEY_PREFIX + key, encryptedValue);
    } catch (error) {
      console.error("Error storing data:", error);
    }
  }

  static getItem<T>(key: string): T | null {
    try {
      const encryptedValue = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (!encryptedValue) return null;

      const decryptedValue = this.decrypt(encryptedValue);
      return JSON.parse(decryptedValue) as T;
    } catch (error) {
      console.error("Error retrieving data:", error);
      return null;
    }
  }

  static removeItem(key: string): void {
    localStorage.removeItem(STORAGE_KEY_PREFIX + key);
  }

  static clear(): void {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(STORAGE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const extractMediaFromReadme = (
  readmeContent: string
): { images: string[]; videos: string[] } => {
  const images: string[] = [];
  const videos: string[] = [];

  // Extract image URLs from markdown
  const imageRegex = /!\[.*?\]\((.*?)\)/g;
  let match;
  while ((match = imageRegex.exec(readmeContent)) !== null) {
    images.push(match[1]);
  }

  // Extract video URLs from markdown
  const videoRegex = /<video.*?src="(.*?)".*?>/g;
  while ((match = videoRegex.exec(readmeContent)) !== null) {
    videos.push(match[1]);
  }

  return { images, videos };
};

export const getLanguageColor = (language: string): string => {
  const colors: { [key: string]: string } = {
    JavaScript: "#f7df1e",
    TypeScript: "#3178c6",
    Python: "#3776ab",
    Java: "#ed8b00",
    "C++": "#00599c",
    "C#": "#239120",
    PHP: "#777bb4",
    Ruby: "#cc342d",
    Go: "#00add8",
    Rust: "#000000",
    Swift: "#fa7343",
    Kotlin: "#7f52ff",
    Dart: "#0175c2",
    HTML: "#e34f26",
    CSS: "#1572b6",
    SCSS: "#cf649a",
    Vue: "#4fc08d",
    React: "#61dafb",
    Angular: "#dd0031",
  };

  return colors[language] || "#6b7280";
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
};

export const generateHashtags = (project: any): string[] => {
  const hashtags: string[] = [];

  // Add language-based hashtags
  if (project.language) {
    hashtags.push(`#${project.language.toLowerCase()}`);
  }

  // Add topic-based hashtags
  if (project.topics && project.topics.length > 0) {
    project.topics.slice(0, 3).forEach((topic: string) => {
      hashtags.push(`#${topic.replace(/[^a-zA-Z0-9]/g, "")}`);
    });
  }

  // Add common development hashtags
  hashtags.push("#opensource", "#development", "#coding");

  // Add specific hashtags based on project characteristics
  if (project.homepage) hashtags.push("#webapp");
  if (project.has_pages) hashtags.push("#github");
  if (project.stargazers_count > 50) hashtags.push("#popular");

  // Remove duplicates and limit to 10 hashtags
  return [...new Set(hashtags.map((tag) => tag.toLowerCase()))].slice(0, 10);
};

export const cleanLinkedInText = (text: string): string => {
  let cleaned = text;

  // Remove bold markdown (**text** -> text)
  cleaned = cleaned.replace(/\*\*(.*?)\*\*/g, "$1");

  // Remove italic markdown (*text* -> text)
  cleaned = cleaned.replace(/\*(.*?)\*/g, "$1");

  // Remove heading markdown (# -> "")
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // Remove code blocks (```text``` -> text)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```/g, "").trim();
  });

  // Remove inline code (`text` -> text)
  cleaned = cleaned.replace(/`([^`]+)`/g, "$1");

  // Remove link markdown ([text](url) -> text)
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Clean up extra spaces but preserve line breaks
  cleaned = cleaned.replace(/[ \t]+/g, " ").trim();

  // Ensure proper line breaks for LinkedIn (convert multiple line breaks to double)
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, "\n\n");

  return cleaned;
};

// LinkedIn'in özel formatlaması için Unicode karakterler kullanan fonksiyon
export const formatLinkedInText = (text: string): string => {
  let formatted = text;

  // LinkedIn için kalın yazı - Unicode Mathematical Bold karakterleri
  const boldMap: { [key: string]: string } = {
    A: "𝗔",
    B: "𝗕",
    C: "𝗖",
    D: "𝗗",
    E: "𝗘",
    F: "𝗙",
    G: "𝗚",
    H: "𝗛",
    I: "𝗜",
    J: "𝗝",
    K: "𝗞",
    L: "𝗟",
    M: "𝗠",
    N: "𝗡",
    O: "𝗢",
    P: "𝗣",
    Q: "𝗤",
    R: "𝗥",
    S: "𝗦",
    T: "𝗧",
    U: "𝗨",
    V: "𝗩",
    W: "𝗪",
    X: "𝗫",
    Y: "𝗬",
    Z: "𝗭",
    a: "𝗮",
    b: "𝗯",
    c: "𝗰",
    d: "𝗱",
    e: "𝗲",
    f: "𝗳",
    g: "𝗴",
    h: "𝗵",
    i: "𝗶",
    j: "𝗷",
    k: "𝗸",
    l: "𝗹",
    m: "𝗺",
    n: "𝗻",
    o: "𝗼",
    p: "𝗽",
    q: "𝗾",
    r: "𝗿",
    s: "𝘀",
    t: "𝘁",
    u: "𝘂",
    v: "𝘃",
    w: "𝘄",
    x: "𝘅",
    y: "𝘆",
    z: "𝘇",
    "0": "𝟬",
    "1": "𝟭",
    "2": "𝟮",
    "3": "𝟯",
    "4": "𝟰",
    "5": "𝟱",
    "6": "𝟲",
    "7": "𝟳",
    "8": "𝟴",
    "9": "𝟵",
  };

  // LinkedIn için italik yazı - Unicode Mathematical Italic karakterleri
  const italicMap: { [key: string]: string } = {
    A: "𝘼",
    B: "𝘽",
    C: "𝘾",
    D: "𝘿",
    E: "𝙀",
    F: "𝙁",
    G: "𝙂",
    H: "𝙃",
    I: "𝙄",
    J: "𝙅",
    K: "𝙆",
    L: "𝙇",
    M: "𝙈",
    N: "𝙉",
    O: "𝙊",
    P: "𝙋",
    Q: "𝙌",
    R: "𝙍",
    S: "𝙎",
    T: "𝙏",
    U: "𝙐",
    V: "𝙑",
    W: "𝙒",
    X: "𝙓",
    Y: "𝙔",
    Z: "𝙕",
    a: "𝙖",
    b: "𝙗",
    c: "𝙘",
    d: "𝙙",
    e: "𝙚",
    f: "𝙛",
    g: "𝙜",
    h: "𝙝",
    i: "𝙞",
    j: "𝙟",
    k: "𝙠",
    l: "𝙡",
    m: "𝙢",
    n: "𝙣",
    o: "𝙤",
    p: "𝙥",
    q: "𝙦",
    r: "𝙧",
    s: "𝙨",
    t: "𝙩",
    u: "𝙪",
    v: "𝙫",
    w: "𝙬",
    x: "𝙭",
    y: "𝙮",
    z: "𝙯",
  };

  // **kalın** yazıyı Unicode kalın karakterlere çevir
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, (match, text) => {
    return text
      .split("")
      .map((char: string) => boldMap[char] || char)
      .join("");
  });

  // *italik* yazıyı Unicode italik karakterlere çevir
  formatted = formatted.replace(/\*(.*?)\*/g, (match, text) => {
    return text
      .split("")
      .map((char: string) => italicMap[char] || char)
      .join("");
  });

  // Link markdown formatını temizle ([text](url) -> text url)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 $2");

  // Özel semboller ve emoji'ler için LinkedIn uyumlu formatlar
  // Bu karakterler LinkedIn'de düzgün görünür
  formatted = formatted.replace(/🔧/g, "🔧");
  formatted = formatted.replace(/💡/g, "💡");
  formatted = formatted.replace(/👉/g, "👉");
  formatted = formatted.replace(/📂/g, "📂");

  return formatted;
};
