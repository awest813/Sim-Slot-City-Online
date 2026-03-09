import Phaser from "phaser";
import { networkManager } from "../managers/NetworkManager";
import { localStore } from "../store/LocalStore";

export class LoginScene extends Phaser.Scene {
  private mode: "login" | "register" = "login";
  private usernameInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private statusText!: Phaser.GameObjects.Text;
  private modeBtn!: Phaser.GameObjects.Text;
  private formTitle!: Phaser.GameObjects.Text;
  private submitBtn!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: "LoginScene" });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1a);

    // Neon grid lines
    this.drawNeonGrid();

    // Title
    this.add.text(width / 2, 80, "🎰 SLOT CITY", {
      fontSize: "48px",
      color: "#ffd700",
      stroke: "#ff8800",
      strokeThickness: 4,
      fontFamily: "monospace",
      shadow: { blur: 20, color: "#ffd700", fill: true },
    }).setOrigin(0.5);

    this.add.text(width / 2, 130, "The Social Casino", {
      fontSize: "16px",
      color: "#888888",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Login form panel
    const panelX = width / 2 - 160;
    const panelY = 180;

    this.add.graphics()
      .fillStyle(0x111133, 0.9)
      .fillRoundedRect(panelX, panelY, 320, 260, 12)
      .lineStyle(1, 0x3344aa, 1)
      .strokeRoundedRect(panelX, panelY, 320, 260, 12);

    // Form title
    this.formTitle = this.add.text(width / 2, panelY + 24, "LOGIN", {
      fontSize: "18px",
      color: "#ffd700",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // HTML inputs (overlay on canvas)
    this.usernameInput = this.createInput("text", "Username", width / 2, panelY + 80);
    this.passwordInput = this.createInput("password", "Password", width / 2, panelY + 130);

    // Submit button
    this.submitBtn = this.add.text(width / 2, panelY + 185, "[ LOGIN ]", {
      fontSize: "18px",
      color: "#ffd700",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" });

    this.submitBtn.on("pointerover", () => this.submitBtn.setColor("#ffffff"));
    this.submitBtn.on("pointerout", () => this.submitBtn.setColor("#ffd700"));
    this.submitBtn.on("pointerdown", () => this.handleSubmit());

    // Mode toggle
    this.modeBtn = this.add.text(width / 2, panelY + 225, "No account? Register →", {
      fontSize: "11px",
      color: "#4488ff",
      fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" });

    this.modeBtn.on("pointerdown", () => this.toggleMode());

    // Status
    this.statusText = this.add.text(width / 2, panelY + 250, "", {
      fontSize: "11px",
      color: "#ff4444",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // ── Solo / Offline Mode ──────────────────────────────────────
    const dividerY = panelY + 300;
    this.add.text(width / 2, dividerY, "────── or ──────", {
      fontSize: "11px",
      color: "#333355",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    this.add.text(width / 2, dividerY + 22, "Play without an account:", {
      fontSize: "11px",
      color: "#888888",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Guest name input
    const saved = localStore.load();
    const guestInput = document.createElement("input");
    guestInput.type = "text";
    guestInput.placeholder = "Enter a name…";
    guestInput.value = saved.username !== "Guest" ? saved.username : "";
    guestInput.maxLength = 20;
    guestInput.style.cssText = `
      position: absolute;
      left: ${width / 2 - 90}px;
      top: ${dividerY + 42}px;
      width: 180px;
      height: 28px;
      background: #0d0d2e;
      border: 1px solid #334488;
      color: #ffffff;
      font-family: monospace;
      font-size: 13px;
      padding: 2px 8px;
      outline: none;
      border-radius: 4px;
      box-sizing: border-box;
    `;
    guestInput.addEventListener("focus", () => { guestInput.style.borderColor = "#aa00ff"; });
    guestInput.addEventListener("blur",  () => { guestInput.style.borderColor = "#334488"; });
    document.body.appendChild(guestInput);
    // Track for cleanup
    (this as unknown as { _guestInput: HTMLInputElement })._guestInput = guestInput;

    const soloBtn = this.add.text(width / 2, dividerY + 86, "[ Play Solo — No Server ]", {
      fontSize: "13px",
      color: "#aa00ff",
      stroke: "#000",
      strokeThickness: 2,
      fontFamily: "monospace",
    }).setOrigin(0.5).setInteractive({ cursor: "pointer" });

    soloBtn.on("pointerover", () => soloBtn.setColor("#ff00ff"));
    soloBtn.on("pointerout",  () => soloBtn.setColor("#aa00ff"));
    soloBtn.on("pointerdown", () => {
      const name = guestInput.value.trim() || "Guest";
      networkManager.setGuestUser(name);
      this.cleanupAllInputs();
      this.scene.start("CasinoLobbyScene");
    });

    this.add.text(width / 2, dividerY + 108, "5,000 chips · no persistence · no multiplayer", {
      fontSize: "9px",
      color: "#333355",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Footer
    this.add.text(width / 2, height - 30, "Virtual chips only • No real money • 18+ entertainment", {
      fontSize: "10px",
      color: "#333355",
      fontFamily: "monospace",
    }).setOrigin(0.5);

    // Enter key support
    this.input.keyboard?.on("keydown-ENTER", () => this.handleSubmit());
  }

  private createInput(type: string, placeholder: string, x: number, y: number): HTMLInputElement {
    const input = document.createElement("input");
    input.type = type;
    input.placeholder = placeholder;
    input.style.cssText = `
      position: absolute;
      left: ${x - 130}px;
      top: ${y - 16}px;
      width: 260px;
      height: 32px;
      background: #0d0d2e;
      border: 1px solid #334488;
      color: #ffffff;
      font-family: monospace;
      font-size: 14px;
      padding: 4px 10px;
      outline: none;
      border-radius: 4px;
      box-sizing: border-box;
    `;
    input.addEventListener("focus", () => {
      input.style.borderColor = "#ffd700";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "#334488";
    });
    document.body.appendChild(input);
    return input;
  }

  private drawNeonGrid(): void {
    const { width, height } = this.scale;
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x220033, 0.4);

    for (let x = 0; x < width; x += 40) {
      graphics.beginPath();
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
      graphics.strokePath();
    }
    for (let y = 0; y < height; y += 40) {
      graphics.beginPath();
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
      graphics.strokePath();
    }
  }

  private toggleMode(): void {
    this.mode = this.mode === "login" ? "register" : "login";
    const isLogin = this.mode === "login";
    this.modeBtn.setText(isLogin ? "No account? Register →" : "← Back to Login");
    this.formTitle.setText(isLogin ? "LOGIN" : "REGISTER");
    this.submitBtn.setText(isLogin ? "[ LOGIN ]" : "[ REGISTER ]");
    this.statusText.setText("");
  }

  private async handleSubmit(): Promise<void> {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    if (!username || !password) {
      this.statusText.setText("Please enter username and password");
      return;
    }

    this.statusText.setColor("#aaaaaa").setText(
      this.mode === "register" ? "Creating account..." : "Signing in...",
    );

    try {
      if (this.mode === "register") {
        await networkManager.register(username, password);
      } else {
        await networkManager.login(username, password);
      }
      this.cleanupAllInputs();
      this.scene.start("CasinoLobbyScene");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error";
      this.statusText.setColor("#ff4444").setText(msg);
    }
  }

  private cleanup(): void {
    if (this.usernameInput.parentNode) {
      document.body.removeChild(this.usernameInput);
    }
    if (this.passwordInput.parentNode) {
      document.body.removeChild(this.passwordInput);
    }
  }

  private cleanupAllInputs(): void {
    this.cleanup();
    const gi = (this as unknown as { _guestInput?: HTMLInputElement })._guestInput;
    if (gi?.parentNode) {
      document.body.removeChild(gi);
    }
  }

  shutdown(): void {
    this.cleanupAllInputs();
  }
}
