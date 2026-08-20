# Contributing to Aarogya X

Thank you for your interest in contributing to **Aarogya X**! We welcome bug reports, feature enhancements, documentation improvements, and machine-learning model refinements.

---

## Code of Conduct

Maintain a respectful, supportive, and collaborative environment. All contributions must adhere to professional open-source standards.

---

## How to Contribute

1. **Fork the Repository**: Click the "Fork" button at the top right of the GitHub page.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/amazing-new-feature
   ```
3. **Make Your Changes**:
   - Write clean, documented code.
   - Follow existing style guidelines (PEP 8 for Python, ESLint/TypeScript standards for React).
4. **Verify Tests & Typecheck**:
   ```bash
   python -m unittest discover -s tests
   cd frontend && pnpm run typecheck && pnpm run build
   ```
5. **Commit Your Changes**:
   ```bash
   git commit -m "feat: add antibiotic dosage calculator for pediatric cases"
   ```
6. **Push to GitHub**:
   ```bash
   git push origin feature/amazing-new-feature
   ```
7. **Open a Pull Request**: Submit a PR to the `main` branch describing your proposed changes and testing verification.

---

## Security Reporting

If you discover a security vulnerability or hardcoded secret in this repository, please do **NOT** post it publicly on issues. Submit a report directly to the repository maintainer.
