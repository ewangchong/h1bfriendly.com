variable "aws_region" {
  description = "The AWS region to deploy to."
  type        = string
  default     = "us-east-1"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_cidr" {
  description = "CIDR block for the Subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "instance_type" {
  description = "EC2 instance type for running Docker Compose"
  type        = string
  default     = "t3.small"
}

variable "key_name" {
  description = "The name of the SSH key pair to attach to the instance. You must create this key in AWS manually first if you want SSH access."
  type        = string
  default     = ""
}

# --- Optional Existing Network Resources ---

variable "vpc_id" {
  description = "ID of an existing VPC to deploy into. If left empty, a new VPC will be created."
  type        = string
  default     = ""
}

variable "subnet_id" {
  description = "ID of an existing Subnet to deploy into. Must belong to the provided vpc_id. If left empty, a new subnet will be created."
  type        = string
  default     = ""
}

variable "security_group_ids" {
  description = "List of existing Security Group IDs to attach to the EC2 instance. If left empty, a new security group will be created."
  type        = list(string)
  default     = []
}

