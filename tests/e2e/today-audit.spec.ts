import { expect, test } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createSessionToken } from "@/lib/auth/token";

function loadAuthSecretForE2E() {
  if (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET) return;
  for (const file of [".env.local", ".env"]) {
    const path = join(process.cwd(), file);
    if (!existsSync(path)) continue;
    const match = readFileSync(path, "utf-8").match(/^(AUTH_SECRET|NEXTAUTH_SECRET)=(.*)$/m);
    if (match?.[1] && match?.[2]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      return;
    }
  }
}

test("login, opens Today dashboard and follows prediction audit", async ({ context, page }) => {
  const predictionRequests: string[] = [];
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  loadAuthSecretForE2E();
  const sessionUser = {
    id: "user_e2e",
    email: "e2e@example.com",
    name: "E2E Analyst",
    role: "user" as const,
    status: "approved" as const,
  };
  const sessionToken = await createSessionToken(sessionUser);

  await page.route("**/api/auth/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        authenticated: true,
        data: {
          user: sessionUser,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
      }),
    });
  });

  await page.route("**/api/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": `nba_auth_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`,
      },
      body: JSON.stringify({
        success: true,
        status: "approved",
        data: {
          user: sessionUser,
        },
      }),
    });
  });

  await page.route(/\/api\/predictions\/today(?:\?.*)?$/, async (route) => {
    predictionRequests.push(route.request().url());
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          games: [{
            id: "game_e2e",
            status: "scheduled",
            gameTime: "21:00",
            homeTeam: { abbreviation: "BOS", name: "Celtics" },
            awayTeam: { abbreviation: "NYK", name: "Knicks" },
          }],
          picks: [{
            predictionId: "pred_e2e",
            gameId: "game_e2e",
            playerId: "player_e2e",
            playerName: "Test Player",
            team: "BOS",
            market: "player_points",
            side: "over",
            line: 20.5,
            probability: 64,
            confidence: "high",
            edge: 0.06,
            expectedValue: 0.21,
            riskLevel: "baixo",
            reasons: ["Projection above line", "Positive market edge"],
            sportsbook: "E2E Book",
            americanOdds: -110,
            auditUrl: "/api/predictions/pred_e2e",
          }],
          modelVersion: "prediction-engine-v1",
          oddsSnapshotStatus: {
            scannedPlayerMarketSnapshots: 1,
            hasUsableSnapshots: true,
            collectionRequired: false,
            collectEndpoint: "/api/odds/collect",
          },
        },
        source: "boltodds",
        sourceHealth: "ok",
        cacheStatus: "fresh",
        generatedAt: "2026-04-28T12:00:00.000Z",
      }),
    });
  });

  await page.route(/\/predictions\/pred_e2e(?:\?.*)?$/, async (route) => {
    await route.fulfill({
      contentType: "text/html",
      body: `
        <!doctype html>
        <html lang="pt-BR">
          <body>
            <main>
              <h1>Auditoria de Test Player</h1>
              <p>Snapshot de entrada</p>
              <p>prediction-engine-v1</p>
            </main>
          </body>
        </html>
      `,
    });
  });

  await page.goto("/login");
  await page.getByPlaceholder("Email").fill("e2e@example.com");
  await page.getByPlaceholder("Senha").fill("password123");
  await page.getByRole("button", { name: "Entrar" }).click();
  await context.addCookies([{
    name: "nba_auth_session",
    value: sessionToken,
    domain: "localhost",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  }]);

  await page.goto("/today");
  await expect(page.getByRole("heading", { name: "Hoje" })).toBeVisible();
  expect(pageErrors).toEqual([]);
  await expect.poll(() => predictionRequests.length, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.getByText("Test Player over 20.5")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Risco Baixo")).toBeVisible();

  await page.getByRole("link", { name: /Auditoria/ }).first().click({ force: true });
  await expect(page).toHaveURL(/\/predictions\/pred_e2e$/);
  await expect(page.getByRole("heading", { name: "Auditoria de Test Player" })).toBeVisible();
  await expect(page.getByText("Snapshot de entrada")).toBeVisible();
});
