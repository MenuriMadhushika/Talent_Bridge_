using System.Linq.Expressions;

namespace RecruitmentPlatform.API.Repositories
{
    // Generic repository - hides EF Core /
    // LINQ details behind a simple
    // contract so controllers/services never talk to DbContext directly.
    public interface IRepository<T> where T : class
    {
        Task<T?> GetByIdAsync(int id);
        Task<IEnumerable<T>> GetAllAsync();
        Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
        Task<T?> SingleOrDefaultAsync(Expression<Func<T, bool>> predicate);
        Task AddAsync(T entity);
        void Update(T entity);
        void Remove(T entity);

        // Escape hatch for queries that need .
        //Include()/.OrderBy()/paging,
        // without leaking the whole DbContext to callers.
        IQueryable<T> Query();
    }
}
