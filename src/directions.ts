import type { RouteStep } from "./types.js";

type DirectionPanel = "rider" | "driver";

const panels: Record<DirectionPanel, {
  panelId: string;
  labelId: string;
  metaId: string;
  listId: string;
}> = {
  rider: {
    panelId: "rider-directions",
    labelId: "rider-directions-label",
    metaId: "rider-directions-meta",
    listId: "rider-directions-list",
  },
  driver: {
    panelId: "driver-directions",
    labelId: "driver-directions-label",
    metaId: "driver-directions-meta",
    listId: "driver-directions-list",
  },
};

