# Pushing to GitHub

Your local git repository has been initialized and your initial commit is ready!

## Next Steps

### 1. Create a GitHub Repository

1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Repository name: `walking-rpg-app` (or your preferred name)
4. Description: "Location-based RPG mobile app with random creature encounters"
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 2. Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
cd "/Users/lancepease/Java Projects/Walking App"

# Add the remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/walking-rpg-app.git

# Or if you prefer SSH:
# git remote add origin git@github.com:YOUR_USERNAME/walking-rpg-app.git

# Push your code
git branch -M main
git push -u origin main
```

### 3. Verify

Visit your GitHub repository page to see your code!

## Alternative: Using GitHub CLI

If you have GitHub CLI installed:

```bash
gh repo create walking-rpg-app --public --source=. --remote=origin --push
```

## Setting Git User Information (Optional)

If you want to set your git identity for commits:

```bash
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Or set globally:
# git config --global user.name "Your Name"
# git config --global user.email "your.email@example.com"
```

