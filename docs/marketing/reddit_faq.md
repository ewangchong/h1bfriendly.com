# Reddit FAQ & Response Guide: H1B Friendly

Use these responses to handle common questions/objections on r/h1b.

## Q1: Is the data up to date?
**A:** Yes, we currently cover up to Fiscal Year 2025. The data is ingested directly from the U.S. Department of Labor (DOL) LCA Disclosure files. We update the local database quarterly as new DOL data is released.

## Q2: Why is this tool free/open source?
**A:** Because navigating H-1B data shouldn't be a gatekept luxury. I built this to help the community make informed decisions without paying for expensive reports. The project is open source so anyone can verify the aggregation logic or contribute improvements.

## Q3: How does the AI Assistant work? Is it hallucinating?
**A:** The assistant is grounded using Retrieval-Augmented Generation (RAG). It doesn't "invent" data; it queries our local Postgres database for specific slices (company totals, salary averages, title counts) and uses that context to answer your questions. If it doesn't have the data, it's instructed to say so.

## Q4: Does the site track me or sell my data?
**A:** No. We don't even have a login system. We persist chat logs for quality improvement (anonymized), but we do not collect PII (Personally Identifiable Information).

## Q5: I found a salary that looks weird. Why?
**A:** We annualize all wages (hourly, weekly, etc.) for comparison. We also filter out extreme outliers (outside the $10k-$5M range) from averages to prevent data skew from obvious filing errors in the DOL dataset.

## Q6: Can I use this for legal advice?
**A:** Absolutely not. This is a data analytics tool. Always consult with a qualified immigration attorney for legal matters.

## Q7: The site is slow/down.
**A:** We are running on a modest t3.small (2GB RAM). If we get a "Hug of Death" from Reddit, please bear with us. We've optimized the database heavily with covering indexes to keep things as fast as possible.
