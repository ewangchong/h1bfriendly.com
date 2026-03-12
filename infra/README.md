# H1B Friend AWS Deployment (Optimized Stack)

This Terraform configuration provisions a low-cost, production-ready environment on AWS using a single EC2 instance, automated Docker orchestration, and Caddy for HTTPS.

## 🏗 Prerequisites

1. Install [Terraform](https://developer.hashicorp.com/terraform/downloads) CLI.
2. Configure AWS credentials (`aws configure`).
3. Create an AWS Key Pair (remember the name for SSH access).

## 🚀 Deployment Steps

1. **Provision Infrastructure**:

   ```bash
   terraform init
   terraform plan -var="key_name=your-key"
   terraform apply
   ```

2. **Sync Code (Production)**:
   We recommend using `rsync` for rapid updates without the overhead of heavy Git operations on the server:

   ```bash
   # Sync only the necessary application files
   rsync -avz --exclude='node_modules' --exclude='.next' --exclude='venv' \
     -e "ssh -i your-key.pem" . ec2-user@your-ip:~/h1bfinder
   ```

3. **Orchestrate**:
   SSH into the server and launch the containers:
   ```bash
   ssh -i your-key.pem ec2-user@your-ip
   cd h1bfinder
   export GEMINI_API_KEY=your_actual_key_here
   docker compose up -d --build
   ```

   `GEMINI_API_KEY` is required for the `/chat` feature. Without it, the backend will return `Chat is not configured on the server.`

## 🔒 Security & Networking

- **Caddy Reverse Proxy**: Automatically handles SSL certificates via Let's Encrypt for all configured domains (see `Caddyfile`).
- **Firewall**: The security group exposes ports 80 and 443 for public traffic. Application ports (3000, 8089) are protected and only accessible via the proxy.
- **Shared Memory**: The database container is configured with `shm_size: 256mb` to ensure stability during large maintenance operations like `VACUUM`.

## 🧹 Maintenance

- **Reclaiming Space**: Run `docker exec h1b-db vacuum analyze` periodically to keep the 20GB root volume healthy.
- **Destroy Instance**:
  ```bash
  terraform destroy
  ```
