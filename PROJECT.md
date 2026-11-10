# PROJECT.md

# Organization-wide P2P Screen Sharing

## 1. Project Overview

An organization-wide screen-sharing platform that allows authenticated members to share and view screens within a common workspace.

Instead of creating rooms or distributing room codes, users open the workspace and see all currently active screen-sharing sessions across the organization.

The system uses WebRTC-based peer-to-peer media delivery through VDO.Ninja in the initial version. The provider is isolated behind an adapter interface so that the underlying media technology can be replaced in the future without redesigning the application.

### Core Concept

**One organization, one shared workspace.**

- Members can start sharing their screens.
- Active screens automatically appear in the organization workspace.
- Other authorized members can view available screens.
- Sessions automatically become offline when the publisher disconnects or stops sending heartbeats.
- No room creation, room codes, or room passwords are exposed in the user experience.

### Product Principles

1. Simple to use: users should not need to understand rooms, streams, or WebRTC.
2. Organization-wide visibility: all authorized members can discover active screens.
3. Secure by default: only authenticated organization members can access the workspace and view streams.
4. Provider-independent architecture: media providers must be replaceable.
5. Maintainable codebase: clear separation between UI, business logic, infrastructure, and media transport.

---

## 2. Goals and Non-goals

### Goals

- Organization authentication and membership management.
- Organization-wide screen discovery.
- Real-time or near-real-time screen status.
- Start, view, and stop screen-sharing sessions.
- P2P media delivery using VDO.Ninja.
- Heartbeat-based session lifecycle management.
- Adapter architecture for future media providers.
- Responsive web application.
- A foundation for a future native desktop application.

### Non-goals for V1

- Public room creation.
- User-facing room IDs or passwords.
- Customer-facing meeting or conference features.
- Group-based screen visibility.
- Multi-user video conferencing.
- Recording and replaying screen sessions.
- Building a custom WebRTC signaling server.
- Building a custom SFU infrastructure.
- Native desktop implementation in the first release.

---

## 3. Technology Stack

### Frontend

- Next.js
- TypeScript
- shadcn/ui
- Existing project design system and UI components
- Redux Toolkit, only where shared client state is necessary

Reuse existing design tokens, components, and styling conventions. Do not introduce a second design system or duplicate existing UI styles.

### Backend

- Next.js API Routes / Route Handlers
- TypeScript
- Prisma ORM
- PostgreSQL

### Media Transport

- VDO.Ninja
- WebRTC
- STUN / TURN infrastructure provided by the selected media provider

### Infrastructure

- Vercel: Next.js application and API deployment
- Managed PostgreSQL: persistent application data
- VDO.Ninja: media transport and related signaling infrastructure

### Development Tools

- pnpm
- Turborepo
- ESLint
- Prettier
- Vitest
- Playwright

---

## 4. High-level Architecture

```text
                  Organization Members
                           |
                           v
                +----------------------+
                |   Next.js Web App    |
                |                      |
                |  Workspace UI        |
                |  Screen Discovery    |
                |  Screen Viewer       |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |    Backend API       |
                |                      |
                |  Authentication      |
                |  Authorization       |
                |  Screen Registry     |
                |  Session Lifecycle   |
                |  Heartbeat           |
                +----------+-----------+
                           |
                           v
                +----------------------+
                |    PostgreSQL        |
                |                      |
                |  Organizations       |
                |  Memberships         |
                |  Screen Sessions     |
                +----------------------+

        Media Transport (separate from application API)

        Publisher Device
               |
               | WebRTC
               |
               v
          VDO.Ninja
               |
               | WebRTC / TURN Relay
               |
               v
          Viewer Device
```

### Important Architecture Rule

The application backend manages identity, authorization, and session metadata.

It does not proxy the actual screen-sharing video stream.

The media path should remain separate from the application API:

- Application data: Next.js API and PostgreSQL.
- Media transport: WebRTC through the selected media provider.
- Session discovery: Screen Registry.
- Session lifecycle: Backend-managed state and heartbeat.

Vercel is not responsible for forwarding video packets or maintaining a persistent WebSocket media connection.

---

## 5. Core Domain Model

The main domain concept is `ScreenSession`, not `Room`.

A ScreenSession represents one active or recently active screen-sharing session belonging to an organization member.

### Organization

Represents an organization or workspace.

Suggested fields:

- id
- name
- createdAt
- updatedAt

### User

Represents an authenticated user.

Suggested fields:

- id
- name
- email
- createdAt
- updatedAt

### OrganizationMember

Connects users to organizations.

Suggested fields:

- id
- organizationId
- userId
- role
- createdAt

Possible roles:

- OWNER
- ADMIN
- MEMBER

### ScreenSession

Represents a screen that is being shared.

Suggested fields:

- id
- organizationId
- ownerId
- title
- deviceName
- provider
- providerStreamId
- status
- startedAt
- lastHeartbeatAt
- endedAt
- createdAt
- updatedAt

Possible statuses:

- STARTING
- LIVE
- OFFLINE
- ENDED
- FAILED

`providerStreamId` is an internal transport identifier. It must never be treated as an authentication credential or exposed as a substitute for authorization.

### Database Design Notes

- Every ScreenSession belongs to exactly one organization.
- Every ScreenSession has one publisher/owner.
- A user may have multiple sessions if the product later supports multiple shared displays.
- A session must not be visible outside its organization.
- Ended sessions may be retained for a limited period for diagnostics or audit history.
- Active sessions should be indexed by organization, status, and lastHeartbeatAt.

---

## 6. Workspace Experience

The main application screen is the organization-wide workspace.

### Workspace Dashboard

The dashboard displays all currently active screen-sharing sessions that the signed-in member is authorized to access.

Each screen card should display:

- Screen title
- Publisher name
- Device name, when available
- Live / Offline status
- Session start time
- Optional resolution or stream information
- View Screen action

### Main Actions

**Start Sharing**

Allows a user to select a screen, window, or browser tab and begin publishing.

**View Screen**

Allows a member to open an available screen.

**Stop Sharing**

Stops the publisher and ends the corresponding ScreenSession.

### UX Requirements

- No room creation flow.
- No room code input.
- No room password input.
- No invite-link requirement.
- No manual stream identifier input.
- Screen discovery should happen automatically.
- Loading, offline, failed, and reconnecting states must be understandable.
- Show a clear empty state when nobody is sharing.
- Make the publisher identity visible to viewers.

### Workspace Visibility

All active screens are visible to authorized members of the same organization.

This is an organization-wide model, not a group-based or hybrid visibility model in V1.

---

## 7. Screen Session Lifecycle

A ScreenSession follows a defined lifecycle.

```text
IDLE
  |
  | User starts sharing
  v
STARTING
  |
  | Provider successfully publishes
  v
LIVE
  |
  +------ User stops sharing ------> ENDED
  |
  +------ Connection lost ---------> OFFLINE
  |
  +------ Startup failure ---------> FAILED

OFFLINE
  |
  +------ Publisher reconnects ----> LIVE
  |
  +------ Session expires --------> ENDED
```

### Start Sharing Flow

1. User authenticates.
2. Frontend checks organization membership.
3. User selects a screen to share.
4. Frontend requests permission from the browser.
5. Backend creates a ScreenSession with STARTING status.
6. Media adapter initializes the selected provider.
7. Publisher establishes the media connection.
8. Backend updates the session to LIVE.
9. The session appears in the organization workspace.
10. Publisher periodically sends heartbeats.

### View Screen Flow

1. Viewer opens the organization workspace.
2. Frontend retrieves available ScreenSessions.
3. Viewer selects a LIVE session.
4. Frontend requests viewing authorization from the backend.
5. Backend verifies organization membership and session permissions.
6. Backend returns the required short-lived provider access information.
7. Media adapter connects to the publisher.
8. Viewer receives the screen stream.

The viewer must never gain access simply by knowing a provider stream ID.

### Stop Sharing Flow

1. Publisher requests to stop sharing.
2. Media adapter disconnects the publisher.
3. Backend marks the ScreenSession as ENDED.
4. The session disappears from the active workspace listing.
5. Existing viewers receive a disconnected state.

### Heartbeat

The publisher periodically reports that the session is still active.

Example:

```text
Publisher
    |
    | POST /api/screen-sessions/:id/heartbeat
    |
    v
Backend
    |
    | Update lastHeartbeatAt
    v
PostgreSQL
```

If a session stops sending heartbeats beyond the configured timeout:

- Mark it OFFLINE.
- Remove it from the active screen listing.
- Notify or update viewers when practical.
- Allow a valid publisher to reconnect according to session-expiration rules.

Heartbeat intervals and timeout thresholds should be configurable rather than hardcoded throughout the application.

---

## 8. Media Provider Adapter Architecture

The application must not directly depend on VDO.Ninja throughout the codebase.

All provider-specific functionality belongs behind a shared adapter interface.

### Suggested Interface

```ts
export interface ScreenShareAdapter {
  initialize(): Promise<void>;

  publish(options: PublishOptions): Promise<PublishResult>;

  view(options: ViewOptions): Promise<ViewResult>;

  disconnect(): Promise<void>;

  getStatus(): ConnectionStatus;

  onStatusChange(
    callback: (status: ConnectionStatus) => void
  ): () => void;
}
```

The exact interface may evolve as provider requirements become clearer.

### Provider Implementations

```text
Media
├── ScreenShareAdapter
├── VdoNinjaAdapter
├── NativeWebRTCAdapter (future)
└── SfuAdapter (future)
```

### V1 Provider

`VdoNinjaAdapter`

Responsibilities:

- Initialize the VDO.Ninja integration.
- Publish screen streams.
- View existing streams.
- Handle connection state.
- Disconnect cleanly.
- Translate provider-specific errors into application-level errors.

### Future Providers

`NativeWebRTCAdapter`

- Direct WebRTC implementation.
- Custom signaling infrastructure when justified.
- More control over connection and transport behavior.

`SfuAdapter`

- SFU-based media distribution.
- Better suited to larger viewing audiences or network conditions where P2P is insufficient.

### Adapter Design Rules

- UI components must not import VDO.Ninja-specific APIs.
- Business logic must depend on the adapter interface.
- Provider identifiers and transport details must remain internal.
- Provider-specific errors must be normalized.
- Changing providers should not require redesigning the Workspace UI or ScreenSession domain model.

### Important Transport Detail

The product does not expose rooms to users, but the selected provider may still require internal stream IDs, room-like identifiers, or routing parameters.

These are implementation details of the transport layer, not user-facing application concepts.

Do not assume that removing room management from the UI means the underlying provider has no room or stream identifiers.

---

## 9. API Design

Suggested API endpoints:

### Authentication and Organization

```text
GET    /api/me
GET    /api/organizations
GET    /api/organizations/:id
GET    /api/organizations/:id/members
```

### Screen Registry

```text
GET    /api/screen-sessions
POST   /api/screen-sessions
GET    /api/screen-sessions/:id
PATCH  /api/screen-sessions/:id
DELETE /api/screen-sessions/:id
```

### Session Lifecycle

```text
POST   /api/screen-sessions/:id/heartbeat
POST   /api/screen-sessions/:id/start
POST   /api/screen-sessions/:id/stop
POST   /api/screen-sessions/:id/view-authorize
```

The exact endpoint structure can be refined during implementation.

### API Rules

- Every endpoint must authenticate the user.
- Every session operation must verify organization membership.
- Only the publisher or an authorized administrator may stop a session.
- View authorization must be checked on the backend.
- Validate all request bodies and parameters.
- Never trust organization IDs supplied by the client without authorization checks.
- Avoid exposing provider secrets or long-lived credentials.

---

## 10. Real-time Screen Discovery

The workspace needs to reflect screen status changes without requiring users to reload the page.

### V1 Recommendation

Start with polling.

Example:

```text
GET /api/screen-sessions?status=LIVE
```

The frontend periodically refreshes the active screen list.

Advantages:

- Simple implementation.
- Works with serverless hosting.
- No persistent WebSocket server required.
- Easy to test and maintain.

### Future Improvements

Consider managed realtime services or event-based updates when polling becomes insufficient.

Possible improvements:

- Immediate screen appearance.
- Live status updates.
- Publisher disconnection notifications.
- Viewer count updates.

Do not introduce unnecessary realtime infrastructure before the basic workflow is stable.

---

## 11. Security

Even though the system does not use room passwords, it must still enforce access control.

### Authentication

- Only authenticated users can access the application.
- Organization membership determines workspace access.
- Sessions must be scoped to an organization.

### Authorization

- Verify membership before listing screens.
- Verify membership before creating or stopping sessions.
- Verify authorization before viewing streams.
- Use short-lived viewing authorization where supported.
- Prevent cross-organization access.

### Media Security

- Do not use stream IDs as authentication secrets.
- Do not expose provider credentials in frontend source code.
- Do not store long-lived provider credentials in browser storage.
- Validate publisher ownership before allowing session modifications.
- Use HTTPS in production.

### Operational Security

- Apply request validation and rate limiting to sensitive endpoints.
- Keep an audit trail for important session operations where appropriate.
- Avoid logging access tokens or sensitive provider information.
- Handle expired and revoked authorization correctly.

---

## 12. Monorepo Structure

Use pnpm workspaces and Turborepo.

Suggested structure:

```text
screen-workspace/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── ...
│   │
│   └── desktop/                 # Future
│
├── packages/
│   ├── database/
│   │   ├── prisma/
│   │   └── src/
│   │
│   ├── domain/
│   │   ├── screen-session/
│   │   ├── organization/
│   │   └── ...
│   │
│   ├── media/
│   │   ├── src/
│   │   │   ├── adapters/
│   │   │   ├── types/
│   │   │   └── index.ts
│   │   └── ...
│   │
│   ├── shared/
│   │   ├── types/
│   │   ├── validators/
│   │   └── utils/
│   │
│   └── config/
│
├── docs/
│   ├── architecture.md
│   ├── media-provider.md
│   └── security.md
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── PROJECT.md
```

### Package Responsibilities

- `apps/web`: Next.js application and user interface.
- `packages/database`: Prisma schema and database access.
- `packages/domain`: Core business entities and rules.
- `packages/media`: Provider-independent media adapter interfaces and implementations.
- `packages/shared`: Shared types, schemas, and utilities.
- `packages/config`: Shared development configuration.
- `apps/desktop`: Future desktop application.

Keep the domain layer independent of Next.js and provider-specific SDKs wherever practical.

---

## 13. Deployment Architecture

### V1 Deployment

```text
                  Internet
                     |
                     v
               Vercel Hosting
                     |
             +-------+-------+
             |               |
             v               v
         Next.js App      API Routes
                             |
                             v
                       Managed PostgreSQL


Publisher Device
       |
       | WebRTC
       v
   VDO.Ninja
       |
       | WebRTC / TURN
       v
   Viewer Device
```

### Deployment Responsibilities

**Vercel**

- Host frontend.
- Execute API routes.
- Authenticate and authorize requests.
- Manage screen metadata and lifecycle operations.

**Managed PostgreSQL**

- Store users and organizations.
- Store organization memberships.
- Store ScreenSession metadata.
- Maintain session status and heartbeat timestamps.

**VDO.Ninja**

- Handle the initial media-provider integration.
- Support the required WebRTC publishing and viewing workflow.

### Important Considerations

- The application database and media infrastructure are separate.
- Vercel does not relay screen video.
- Do not depend on long-lived in-memory state inside serverless functions.
- Use the database or a suitable external service as the source of truth for session metadata.
- Confirm the provider's current API, embedding, authentication, and deployment requirements before implementation.

---

## 14. Development Phases

Development must be incremental. Each phase should have working functionality and tests before moving to the next phase.

### Phase 01 — Project Foundation

Objectives:

- Initialize the monorepo.
- Configure pnpm and Turborepo.
- Set up Next.js and TypeScript.
- Configure linting and formatting.
- Establish shared environment configuration.
- Set up the database package.

Deliverables:

- Running Next.js application.
- Working monorepo scripts.
- Database connection.
- Initial documentation.

Tests:

- Build succeeds.
- Type checking succeeds.
- Linting succeeds.
- Database connection test passes.

### Phase 02 — Organization and Authentication

Objectives:

- Implement user authentication.
- Implement organization membership.
- Implement organization-level authorization.
- Establish role-based access rules.

Deliverables:

- Sign-in flow.
- Organization workspace access.
- Membership validation.

Tests:

- Unauthenticated requests are rejected.
- Non-members cannot access an organization.
- Members can access their organization.
- Cross-organization access is rejected.

### Phase 03 — Screen Registry

Objectives:

- Implement ScreenSession domain model.
- Implement database schema.
- Implement screen registration and listing.
- Implement status transitions.
- Implement heartbeat and offline detection.

Deliverables:

- ScreenSession API.
- Workspace screen listing.
- Session lifecycle management.

Tests:

- A user can register a session.
- Authorized members can discover sessions.
- Unauthorized users cannot discover sessions.
- Heartbeat updates lastHeartbeatAt.
- Stale sessions become offline.
- Ended sessions disappear from the active listing.

### Phase 04 — Media Adapter and VDO.Ninja

Objectives:

- Define the media adapter interface.
- Investigate and integrate the current VDO.Ninja publishing and viewing workflow.
- Implement VdoNinjaAdapter.
- Normalize provider connection states and errors.

Deliverables:

- Working screen publisher.
- Working screen viewer.
- Clean disconnect behavior.

Tests:

- Adapter initialization.
- Publish success and failure.
- View authorization.
- Connection state changes.
- Disconnect cleanup.
- Provider errors are normalized.

### Phase 05 — Workspace UI

Objectives:

- Build the organization-wide workspace.
- Build screen cards.
- Implement Start Sharing and Stop Sharing.
- Implement View Screen.
- Add loading, empty, offline, and error states.
- Integrate polling.

Deliverables:

- Functional workspace dashboard.
- Screen-sharing workflow.
- Viewer interface.

Tests:

- Workspace displays active sessions.
- New sessions appear after refresh/polling.
- Offline sessions are handled correctly.
- UI prevents invalid actions.
- Responsive layout works on supported screen sizes.

### Phase 06 — Security and Reliability

Objectives:

- Review all authorization boundaries.
- Review provider credential handling.
- Add rate limiting where appropriate.
- Handle browser permission denial.
- Handle network interruptions.
- Improve reconnection and cleanup behavior.

Deliverables:

- Security review.
- Error handling.
- Reliability tests.

Tests:

- Cross-organization access attempts fail.
- Unauthorized viewing fails.
- Invalid heartbeat requests fail.
- Stale sessions are cleaned up.
- Interrupted connections do not leave permanent LIVE sessions.

### Phase 07 — Production Readiness

Objectives:

- Configure production deployment.
- Configure environment variables.
- Set up database migrations.
- Add monitoring and structured logging.
- Test real-world network conditions.
- Document deployment and troubleshooting.

Deliverables:

- Production deployment.
- Deployment documentation.
- Operational checklist.

Tests:

- Production build succeeds.
- Database migrations work.
- End-to-end sharing workflow works.
- Multiple organization members can view the workspace.
- P2P and TURN-relayed scenarios are tested where possible.

---

## 15. Testing Strategy

### Unit Tests

Focus on:

- ScreenSession state transitions.
- Authorization rules.
- Heartbeat timeout logic.
- Provider adapter behavior.
- Input validation.

### Integration Tests

Focus on:

- API and database interaction.
- Organization membership enforcement.
- ScreenSession lifecycle.
- Provider authorization flow.

### End-to-end Tests

Focus on:

1. User signs in.
2. User opens the workspace.
3. User starts screen sharing.
4. Another organization member sees the screen.
5. The second member opens the stream.
6. Publisher stops sharing.
7. Workspace reflects the updated status.

### Manual Network Tests

Test:

- Same local network.
- Different networks.
- NAT-restricted networks.
- TURN relay fallback.
- Browser permission denial.
- Publisher browser closed unexpectedly.
- Temporary network disconnection.

---

## 16. Environment Variables

Example configuration:

```env
DATABASE_URL=

AUTH_SECRET=
AUTH_URL=

NEXT_PUBLIC_APP_URL=

MEDIA_PROVIDER=vdo_ninja

# Provider-specific configuration should only be added
# after confirming the actual integration requirements.
```

Rules:

- Never commit secrets.
- Validate required variables at application startup.
- Separate development and production environments.
- Do not expose server-only secrets through `NEXT_PUBLIC_` variables.

---

## 17. Future Roadmap

### Native Desktop Application

Potential future direction:

- Rust
- GPUI
- Native screen capture
- Native system integration

The desktop client should reuse the same domain concepts and media adapter contract where practical.

GPUI is a native UI framework, not a web runtime. If the desktop application needs to reuse the VDO.Ninja JavaScript SDK, it will require an appropriate JavaScript runtime or WebView integration. A native Rust/WebRTC implementation may be considered later.

### Media Infrastructure

Possible future improvements:

- Native WebRTC provider.
- Custom signaling service.
- TURN infrastructure under direct control.
- SFU-based distribution.
- Adaptive stream quality.
- Viewer count and connection diagnostics.

### Workspace Improvements

- Search and filter active screens.
- Screen thumbnails or previews.
- Pin frequently viewed screens.
- Publisher device management.
- Session history.
- Organization-level administrative controls.

These features should only be added when the core sharing workflow is stable.

---

## 18. Definition of Done

A feature is considered complete when:

- It meets the stated requirements.
- It follows the project's architecture boundaries.
- It includes appropriate tests.
- It handles expected errors.
- It does not introduce unauthorized access.
- It has no unnecessary provider-specific dependencies outside the media package.
- It is documented when the behavior or architecture changes.

A phase is complete only when its deliverables and tests pass.

---

## 19. V1 Success Criteria

The first production-ready version should allow:

1. An authenticated organization member to open the workspace.
2. A member to start sharing a screen without creating a room.
3. Other authorized members to discover the active screen automatically.
4. An authorized member to view the shared screen.
5. The publisher to stop sharing cleanly.
6. The system to detect disconnected or stale sessions.
7. The workspace to reflect current session status.
8. The application to prevent cross-organization access.
9. The media implementation to be replaceable through the adapter architecture.

**The primary success criterion is a simple and reliable organization-wide screen-sharing experience, not the number of media features or infrastructure components.**
