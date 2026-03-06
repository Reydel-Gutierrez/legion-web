
import OverviewImg from "../assets/img/pages/overview.jpg";
import TransactionsImg from "../assets/img/pages/transactions.jpg";
import SettingsImg from "../assets/img/pages/settings.jpg";
import SignInImg from "../assets/img/pages/sign-in.jpg";
import SignUpImg from "../assets/img/pages/sign-up.jpg";
import LockImg from "../assets/img/pages/lock.jpg";
import ForgotPasswordImg from "../assets/img/pages/forgot-password.jpg";
import ResetPasswordImg from "../assets/img/pages/reset-password.jpg";
import NotFoundImg from "../assets/img/pages/404.jpg";
import ServerErrorImg from "../assets/img/pages/500.jpg";
import LegionDashboard from "../pages/Legion/Dashboard";
import LegionSite from "../pages/Legion/Site"; // or "../pages/Legion/Layout" if you rename
import LegionEquipment from "../pages/Legion/Equipment";
import LegionEquipmentDetail from "../pages/Legion/EquipmentDetail";
import LegionAlarms from "../pages/Legion/Alarms";
import LegionTrends from "../pages/Legion/Trends";
import LegionSchedules from "../pages/Legion/Schedules";
import LegionEvents from "../pages/Legion/Events";
import LegionSettings from "../pages/Legion/Settings";
import LegionUsers from "../pages/Legion/Users";


import { Routes } from "../routes";


export default [
    {
        "id": 1,
        "name": "Overview",
        "image": OverviewImg,
        "link": Routes.DashboardOverview.path
    },
    {
        "id": 2,
        "name": "Transactions",
        "image": TransactionsImg,
        "link": Routes.Transactions.path
    },
    {
        "id": 3,
        "name": "Settings",
        "image": SettingsImg,
        "link": Routes.Settings.path
    },
    {
        "id": 4,
        "name": "Sign In",
        "image": SignInImg,
        "link": Routes.Signin
    },
    {
        "id": 5,
        "name": "Sign Up",
        "image": SignUpImg,
        "link": Routes.Signup.path
    },
    {
        "id": 6,
        "name": "Lock",
        "image": LockImg,
        "link": Routes.Lock.path
    },
    {
        "id": 7,
        "name": "Forgot password",
        "image": ForgotPasswordImg,
        "link": Routes.ForgotPassword.path
    },
    {
        "id": 8,
        "name": "Reset password",
        "image": ResetPasswordImg,
        "link": Routes.ResetPassword.path
    },
    {
        "id": 9,
        "name": "404",
        "image": NotFoundImg,
        "link": Routes.NotFound.path
    },
    {
        "id": 10,
        "name": "500",
        "image": ServerErrorImg,
        "link": Routes.ServerError.path
    },
        { path: Routes.LegionDashboard.path, component: LegionDashboard, exact: true },
        { path: Routes.LegionSite.path, component: LegionSite, exact: true },
        { path: Routes.LegionEquipment.path, component: LegionEquipment, exact: true },
        { path: Routes.LegionEquipmentDetail.path, component: LegionEquipmentDetail, exact: true },
        { path: Routes.LegionAlarms.path, component: LegionAlarms, exact: true },
        { path: Routes.LegionTrends.path, component: LegionTrends, exact: true },
        { path: Routes.LegionSchedules.path, component: LegionSchedules, exact: true },
        { path: Routes.LegionEvents.path, component: LegionEvents, exact: true },
        { path: Routes.LegionSettings.path, component: LegionSettings, exact: true },
        { path: Routes.LegionUsers.path, component: LegionUsers, exact: true }
];