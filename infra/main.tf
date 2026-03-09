provider "aws" {
  region = var.aws_region
}

# --- Network logic variables ---
locals {
  create_vpc    = var.vpc_id == ""
  vpc_id        = local.create_vpc ? aws_vpc.h1b_vpc[0].id : var.vpc_id

  create_subnet = var.subnet_id == ""
  subnet_id     = local.create_subnet ? aws_subnet.h1b_subnet[0].id : var.subnet_id

  create_sg     = length(var.security_group_ids) == 0
  sg_ids        = local.create_sg ? [aws_security_group.h1b_sg[0].id] : var.security_group_ids
}

# --- Network Resources ---

resource "aws_vpc" "h1b_vpc" {
  count                = local.create_vpc ? 1 : 0
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "h1bfriend-vpc"
  }
}

resource "aws_internet_gateway" "h1b_igw" {
  count  = local.create_vpc ? 1 : 0
  vpc_id = local.vpc_id

  tags = {
    Name = "h1bfriend-igw"
  }
}

resource "aws_subnet" "h1b_subnet" {
  count                   = local.create_subnet ? 1 : 0
  vpc_id                  = local.vpc_id
  cidr_block              = var.subnet_cidr
  map_public_ip_on_launch = true

  tags = {
    Name = "h1bfriend-subnet"
  }
}

resource "aws_route_table" "h1b_rt" {
  count  = local.create_vpc ? 1 : 0
  vpc_id = local.vpc_id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.h1b_igw[0].id
  }

  tags = {
    Name = "h1bfriend-rt"
  }
}

resource "aws_route_table_association" "h1b_rta" {
  count          = local.create_subnet && local.create_vpc ? 1 : 0
  subnet_id      = local.subnet_id
  route_table_id = aws_route_table.h1b_rt[0].id
}

# --- Security Group ---

resource "aws_security_group" "h1b_sg" {
  count       = local.create_sg ? 1 : 0
  name        = "h1bfriend-sg"
  description = "Allow HTTP, HTTPS, SSH, and App ports"
  vpc_id      = local.vpc_id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "h1bfriend-sg"
  }
}

# --- EC2 Instance ---

# Get latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "h1b_server" {
  ami           = data.aws_ami.amazon_linux_2023.id
  instance_type = var.instance_type
  subnet_id     = local.subnet_id
  
  vpc_security_group_ids = local.sg_ids
  key_name               = var.key_name != "" ? var.key_name : null

  root_block_device {
    volume_size = 20
    volume_type = "gp3"
  }

  user_data = <<-EOF
              #!/bin/bash
              sudo dnf update -y
              # Install Docker
              sudo dnf install -y docker
              sudo systemctl enable docker
              sudo systemctl start docker
              sudo usermod -aG docker ec2-user
              
              # Install Docker Compose plugin
              sudo dnf install -y docker-compose-plugin
              
              # Install git
              sudo dnf install -y git

              # Configure Swap (4GB) to prevent OOM on high traffic
              sudo dd if=/dev/zero of=/swapfile bs=128M count=32
              sudo chmod 600 /swapfile
              sudo mkswap /swapfile
              sudo swapon /swapfile
              echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
              EOF

  tags = {
    Name = "h1bfriend-server"
  }
}

# --- Elastic IP ---

resource "aws_eip" "h1b_eip" {
  instance = aws_instance.h1b_server.id
  domain   = "vpc"

  tags = {
    Name = "h1bfriend-eip"
  }
}

# --- Outputs ---

output "public_ip" {
  value       = aws_eip.h1b_eip.public_ip
  description = "The Elastic IP address of the H1B Friend server"
}

output "ssh_command" {
  value       = "ssh -i <your-key.pem> ec2-user@${aws_eip.h1b_eip.public_ip}"
  description = "Command to SSH into the server"
}
