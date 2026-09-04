import { Outlet } from "react-router-dom";
import { Toaster } from "react-hot-toast";

const MainLayout = ({ children }) => {
  return (
    <>
      <Toaster />
      {!children && <Outlet />}
    </>
  );
};

export default MainLayout;
