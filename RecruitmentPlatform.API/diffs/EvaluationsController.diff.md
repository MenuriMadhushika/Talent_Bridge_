# Controllers/EvaluationsController.cs

## 1. Add two new fields + inject the new services in the constructor

FIND:
```csharp
    public class EvaluationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAuditService _auditService;

        public EvaluationsController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager, IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _auditService = auditService;
        }
```

REPLACE WITH:
```csharp
    public class EvaluationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAuditService _auditService;
        private readonly IFeedbackGenerationService _feedbackService;
        private readonly INotificationService _notificationService;

        public EvaluationsController(
            IUnitOfWork unitOfWork,
            UserManager<ApplicationUser> userManager,
            IAuditService auditService,
            IFeedbackGenerationService feedbackService,
            INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _auditService = auditService;
            _feedbackService = feedbackService;
            _notificationService = notificationService;
        }
```

## 2. Add a new endpoint (paste anywhere inside the class, e.g. after `Create`)

```csharp
        /// <summary>Recruiter/HiringManager/Admin: generate an AI-written
        /// candidate-facing feedback message from an evaluation's raw notes,
        /// and send it to the candidate as a notification (in-app + SMS if
        /// they have a phone number on file). Covers the "Automated feedback
        /// generation" requirement.</summary>
        [HttpPost("{id:int}/generate-feedback")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GenerateFeedback(int id, [FromQuery] bool send = false)
        {
            var evaluation = await _unitOfWork.Evaluations.Query()
                .Include(e => e.JobApplication).ThenInclude(a => a.JobPosting)
                .Include(e => e.JobApplication).ThenInclude(a => a.CandidateProfile).ThenInclude(c => c.User)
                .SingleOrDefaultAsync(e => e.Id == id);

            if (evaluation is null) return NotFound("Evaluation not found.");

            var candidateUser = evaluation.JobApplication.CandidateProfile.User;
            var candidateName = $"{candidateUser.FirstName} {candidateUser.LastName}".Trim();
            var jobTitle = evaluation.JobApplication.JobPosting.Title;

            var feedback = await _feedbackService.GenerateCandidateFeedbackAsync(
                candidateName, jobTitle, evaluation.JobApplication.Status, evaluation.Comments);

            if (send)
            {
                await _notificationService.NotifyAsync(
                    candidateUser.Id,
                    $"Update on your {jobTitle} application",
                    feedback);
                await _auditService.LogAsync(CurrentUserId, "FeedbackSent", "Evaluation", null, $"Evaluation #{id}");
            }

            return Ok(new { feedback });
        }
```
