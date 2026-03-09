import Colyseus from "colyseus.js";
import { SERVER_URL, API_URL } from "../config/constants";
import { ClientMessage } from "@slot-city/shared";

export interface AuthUser {
  id: string;
  username: string;
  chips: number;
  outfitId?: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

class NetworkManager {
  private client!: Colyseus.Client;
  private currentRoom: Colyseus.Room | null = null;
  private token: string | null = null;
  private user: AuthUser | null = null;

  init(): void {
    this.client = new Colyseus.Client(SERVER_URL);
    const savedToken = localStorage.getItem("slot_city_token");
    if (savedToken) {
      this.token = savedToken;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  async register(username: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Registration failed");
    }
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("slot_city_token", data.token);
    return data as AuthResult;
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }
    this.token = data.token;
    this.user = data.user;
    localStorage.setItem("slot_city_token", data.token);
    return data as AuthResult;
  }

  async validateSession(): Promise<AuthUser | null> {
    if (!this.token) return null;
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      if (!response.ok) {
        this.logout();
        return null;
      }
      const data = await response.json();
      this.user = data.user;
      return this.user;
    } catch {
      return null;
    }
  }

  logout(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem("slot_city_token");
  }

  async joinRoom(roomType: string): Promise<Colyseus.Room> {
    if (!this.token) throw new Error("Not authenticated");

    if (this.currentRoom) {
      await this.currentRoom.leave();
      this.currentRoom = null;
    }

    const room = await this.client.joinOrCreate(roomType, { token: this.token });
    this.currentRoom = room;
    return room;
  }

  async joinRoomById(roomId: string): Promise<Colyseus.Room> {
    if (!this.token) throw new Error("Not authenticated");

    if (this.currentRoom) {
      await this.currentRoom.leave();
      this.currentRoom = null;
    }

    const room = await this.client.joinById(roomId, { token: this.token });
    this.currentRoom = room;
    return room;
  }

  sendMessage(message: ClientMessage): void {
    if (!this.currentRoom) return;
    this.currentRoom.send(message.type, message);
  }

  getCurrentRoom(): Colyseus.Room | null {
    return this.currentRoom;
  }

  async leaveRoom(): Promise<void> {
    if (this.currentRoom) {
      await this.currentRoom.leave();
      this.currentRoom = null;
    }
  }
}

export const networkManager = new NetworkManager();
