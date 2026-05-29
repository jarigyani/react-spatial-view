import {
  SpatialView,
  SpatialViewProvider,
  useSpatialView,
} from "@jarigyani/react-spatial-view";
import type { MouseEvent } from "react";
import kyoto from "./assets/kyoto.jpg";

function App() {
  return (
    <SpatialViewProvider>
      <Content />
    </SpatialViewProvider>
  );
}

const Content = () => {
  const { jumpToElement } = useSpatialView();

  const handleJump = (e: MouseEvent<HTMLDivElement>) => {
    jumpToElement(e.currentTarget, { padding: 100 });
  };

  return (
    <div className="app">
      <SpatialView excludePan={["#draggable"]} padding="100px">
        <div className="photo-frame">
          <img src={kyoto} alt="kyoto" />
        </div>
        <div className="jump-card" onClick={handleJump}>
          <p>Jump Element</p>
        </div>
      </SpatialView>
    </div>
  );
};

export default App;
