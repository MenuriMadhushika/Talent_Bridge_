import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import { LoadingState } from "./components/States";

import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import NotFoundPage from "./pages/NotFoundPage";
import UnauthorizedPage from "./pages/UnauthorizedPage";

// --- Role constants: single source of truth, typo-proof at compile time ---
export const ROLES = Object.freeze({
    CANDIDATE: "Candidate",
    RECRUITER: "Recruiter",
    HIRING_MANAGER: "HiringManager",
    ADMIN: "Admin",
});

const HOME_BY_ROLE = {
    [ROLES.CANDIDATE]: "/jobs",
    [ROLES.RECRUITER]: "/recruiter/postings",
    [ROLES.HIRING_MANAGER]: "/hiring-manager",
    [ROLES.ADMIN]: "/admin",
};

// --- Lazy-loaded page groups: candidates never download admin's bundle, etc. ---
const JobSearchPage = lazy(() => import("./pages/candidate/JobSearchPage"));
const JobDetailPage = lazy(() => import("./pages/candidate/JobDetailPage"));
const ApplicationsPage = lazy(() => import("./pages/candidate/ApplicationsPage"));
const ProfilePage = lazy(() => import("./pages/candidate/ProfilePage"));

const PostingsPage = lazy(() => import("./pages/recruiter/PostingsPage"));
const CreatePostingPage = lazy(() => import("./pages/recruiter/CreatePostingPage"));
const ApplicationReviewPage = lazy(() => import("./pages/recruiter/ApplicationReviewPage"));
const CandidateSearchPage = lazy(() => import("./pages/recruiter/CandidateSearchPage"));
const CandidateDetailPage = lazy(() => import("./pages/recruiter/CandidateDetailPage"));

const HiringManagerDashboardPage = lazy(() => import("./pages/hiringmanager/HiringManagerDashboardPage"));
const ReviewQueuePage = lazy(() => import("./pages/hiringmanager/ReviewQueuePage"));

const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminOrganizationsPage = lazy(() => import("./pages/admin/AdminOrganizationsPage"));

const ApplicationDetailPage = lazy(() => import("./pages/shared/ApplicationDetailPage"));

function HomeRedirect() {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={HOME_BY_ROLE[user.role] || "/jobs"} replace />;
}

export default function App() {
    return (
        <Suspense fallback={<LoadingState text="Loading…" />}>
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/unauthorized" element={<UnauthorizedPage />} />

                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                    <Route path="/" element={<HomeRedirect />} />

                    {/* Candidate portal */}
                    <Route path="/jobs" element={<ProtectedRoute roles={[ROLES.CANDIDATE]}><JobSearchPage /></ProtectedRoute>} />
                    <Route path="/jobs/:jobId" element={<ProtectedRoute roles={[ROLES.CANDIDATE]}><JobDetailPage /></ProtectedRoute>} />
                    <Route path="/applications" element={<ProtectedRoute roles={[ROLES.CANDIDATE]}><ApplicationsPage /></ProtectedRoute>} />
                    <Route path="/profile" element={<ProtectedRoute roles={[ROLES.CANDIDATE]}><ProfilePage /></ProtectedRoute>} />

                    {/* Recruiter portal */}
                    <Route path="/recruiter/postings" element={<ProtectedRoute roles={[ROLES.RECRUITER]}><PostingsPage /></ProtectedRoute>} />
                    <Route path="/recruiter/postings/new" element={<ProtectedRoute roles={[ROLES.RECRUITER]}><CreatePostingPage /></ProtectedRoute>} />
                    <Route path="/recruiter/postings/:jobPostingId/applications" element={<ProtectedRoute roles={[ROLES.RECRUITER]}><ApplicationReviewPage /></ProtectedRoute>} />
                    <Route path="/recruiter/candidates" element={<ProtectedRoute roles={[ROLES.RECRUITER]}><CandidateSearchPage /></ProtectedRoute>} />
                    <Route path="/recruiter/candidates/:candidateId" element={<ProtectedRoute roles={[ROLES.RECRUITER]}><CandidateDetailPage /></ProtectedRoute>} />

                    {/* Hiring manager portal */}
                    <Route path="/hiring-manager" element={<ProtectedRoute roles={[ROLES.HIRING_MANAGER]}><HiringManagerDashboardPage /></ProtectedRoute>} />
                    <Route path="/hiring-manager/review-queue" element={<ProtectedRoute roles={[ROLES.HIRING_MANAGER]}><ReviewQueuePage /></ProtectedRoute>} />

                    {/* Administration portal */}
                    <Route path="/admin" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminDashboardPage /></ProtectedRoute>} />
                    <Route path="/admin/users" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminUsersPage /></ProtectedRoute>} />
                    <Route path="/admin/organizations" element={<ProtectedRoute roles={[ROLES.ADMIN]}><AdminOrganizationsPage /></ProtectedRoute>} />

                    {/* Shared: one route, guarded for every role that can view an application */}
                    <Route
                        path="/applications/:applicationId"
                        element={
                            <ProtectedRoute roles={[ROLES.CANDIDATE, ROLES.RECRUITER, ROLES.HIRING_MANAGER, ROLES.ADMIN]}>
                                <ApplicationDetailPage />
                            </ProtectedRoute>
                        }
                    />
                </Route>

                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </Suspense>
    );
}