# Legion Web

Legion Web is a Building Automation Systems (BAS) platform being developed for two primary workspaces:

- **Operator Mode** — day-to-day building operations
- **Engineering Mode** — configuration, validation, and deployment tools

## Current Scope

The project is currently being restructured from a legacy dashboard template into a modular Legion architecture.

### Operator Modules
- Dashboard
- Site
- Equipment
- Alarms
- Trends
- Schedules
- Events
- Users
- Settings

### Engineering Modules
- Engineering Dashboard
- Site Builder
- Network Discovery
- Point Mapping
- Graphics Manager
- Validation Center
- Deployment
- Logs

## Project Structure

```text
src/
  app/
    layout/
    providers/
    router/
  modules/
    operator/
    engineering/
  components/
    legion/
    ui/
  lib/
    data/
    utils/
  assets/
  scss/